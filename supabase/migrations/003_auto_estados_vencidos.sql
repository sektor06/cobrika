-- ============================================================
--  COBRIKA — Migración 003
--  Automatización diaria de estados: cuotas vencidas, mora,
--  préstamos atrasados/en mora y clientes morosos.
--
--  CÓMO EJECUTAR:
--  1. En Supabase: Database → Extensions → busca "pg_cron"
--     y actívala (botón Enable). Deja el schema "pg_catalog".
--  2. Luego ve a SQL Editor, pega TODO este archivo y Run.
-- ============================================================

-- ── Función que actualiza todos los estados ─────────────────
create or replace function public.actualizar_estados_cobrika()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin

  -- 1) Cuotas pendientes cuya fecha ya pasó → 'vencida'
  update cuotas
  set estado = 'vencida'
  where estado = 'pendiente'
    and fecha_vence < current_date;

  -- 2) Recalcular mora acumulada en cuotas vencidas/parciales
  --    Fórmula (igual que el módulo de morosos):
  --    saldo * (tasa_mora / 30) * días_de_atraso, tras días de gracia
  update cuotas c
  set monto_mora = round(
        greatest(c.monto_total - c.monto_pagado, 0)
        * (coalesce(p.tasa_mora, 0.02) / 30.0)
        * (current_date - c.fecha_vence)
      , 2)
  from prestamos p
  where p.id = c.prestamo_id
    and c.estado in ('vencida','parcial')
    and c.fecha_vence < current_date
    and (current_date - c.fecha_vence) > coalesce(p.dias_gracia, 3);

  -- 3) Préstamos con cuotas vencidas dentro del período de gracia → 'atrasado'
  update prestamos p
  set estado = 'atrasado'
  where p.estado in ('activo','al_dia')
    and exists (
      select 1 from cuotas c
      where c.prestamo_id = p.id
        and c.estado in ('vencida','parcial')
        and c.fecha_vence < current_date
    );

  -- 4) Préstamos con atraso mayor al período de gracia → 'en_mora'
  update prestamos p
  set estado = 'en_mora'
  where p.estado in ('activo','al_dia','atrasado')
    and exists (
      select 1 from cuotas c
      where c.prestamo_id = p.id
        and c.estado in ('vencida','parcial')
        and (current_date - c.fecha_vence) > coalesce(p.dias_gracia, 3)
    );

  -- 5) Préstamos que se pusieron al día → volver a 'al_dia'
  update prestamos p
  set estado = 'al_dia'
  where p.estado in ('atrasado','en_mora')
    and not exists (
      select 1 from cuotas c
      where c.prestamo_id = p.id
        and c.estado in ('pendiente','vencida','parcial')
        and c.fecha_vence < current_date
    );

  -- 6) Clientes con algún préstamo en mora → 'moroso'
  update clientes cl
  set estado = 'moroso'
  where cl.estado = 'activo'
    and exists (
      select 1 from prestamos p
      where p.cliente_id = cl.id and p.estado = 'en_mora'
    );

  -- 7) Clientes morosos que se regularizaron → 'activo'
  --    (no toca clientes bloqueados ni inactivos)
  update clientes cl
  set estado = 'activo'
  where cl.estado = 'moroso'
    and not exists (
      select 1 from prestamos p
      where p.cliente_id = cl.id and p.estado in ('en_mora','atrasado')
    );

end;
$$;

-- ── Programar ejecución diaria a las 12:10 AM hora RD ───────
--    (Supabase corre pg_cron en UTC; RD es UTC-4 → 04:10 UTC)
select cron.schedule(
  'cobrika-estados-diarios',
  '10 4 * * *',
  $$ select public.actualizar_estados_cobrika(); $$
);

-- ── Ejecutar una vez AHORA para poner todo al día ───────────
select public.actualizar_estados_cobrika();

-- ── Verificación (opcional): ver el job programado ──────────
-- select * from cron.job;
