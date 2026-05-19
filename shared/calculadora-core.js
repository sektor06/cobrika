// ============================================================
//  COBRIKA — Calculadora Core
//  shared/calculadora-core.js
//  Motor financiero: cuotas, interés fijo/reducido, mora
// ============================================================

/**
 * Calcular plan de pagos completo
 * @param {object} params
 * @param {number} params.capital        - Monto del préstamo
 * @param {number} params.tasa           - Tasa de interés (ej: 0.10 = 10%)
 * @param {string} params.tipo           - 'fijo' | 'reducido'
 * @param {number} params.numCuotas      - Número de cuotas
 * @param {string} params.frecuencia     - 'diario'|'semanal'|'quincenal'|'mensual'
 * @param {string} params.fechaInicio    - Fecha del primer pago (YYYY-MM-DD)
 * @returns {object} resultado completo con cuotas, totales
 */
export function calcularPlan({ capital, tasa, tipo, numCuotas, frecuencia, fechaInicio }) {
  capital   = Number(capital);
  tasa      = Number(tasa);
  numCuotas = parseInt(numCuotas);

  if (!capital || !tasa || !numCuotas || capital <= 0 || numCuotas <= 0) {
    return null;
  }

  // Tasa por período según frecuencia
  // La tasa ingresada es MENSUAL siempre — la convertimos al período
  const tasaPeriodo = tasaPorFrecuencia(tasa, frecuencia);

  let cuotas = [];
  let totalInteres = 0;

  if (tipo === 'fijo') {
    // ── Interés fijo: mismo monto cada cuota ──────────────
    const interesPorCuota = capital * tasaPeriodo;
    const capitalPorCuota = capital / numCuotas;
    const montoCuota      = capitalPorCuota + interesPorCuota;
    totalInteres          = interesPorCuota * numCuotas;

    for (let i = 1; i <= numCuotas; i++) {
      cuotas.push({
        numero:         i,
        fecha_vence:    calcularFechaVence(fechaInicio, i, frecuencia),
        monto_capital:  round2(capitalPorCuota),
        monto_interes:  round2(interesPorCuota),
        monto_total:    round2(montoCuota),
        monto_mora:     0,
        monto_pagado:   0,
        estado:         'pendiente',
      });
    }

  } else {
    // ── Saldo reducido: interés sobre capital pendiente ───
    let saldo = capital;
    for (let i = 1; i <= numCuotas; i++) {
      const interes      = saldo * tasaPeriodo;
      const capitalCuota = capital / numCuotas;
      const total        = capitalCuota + interes;
      totalInteres      += interes;

      cuotas.push({
        numero:         i,
        fecha_vence:    calcularFechaVence(fechaInicio, i, frecuencia),
        monto_capital:  round2(capitalCuota),
        monto_interes:  round2(interes),
        monto_total:    round2(total),
        monto_mora:     0,
        monto_pagado:   0,
        estado:         'pendiente',
      });

      saldo -= capitalCuota;
    }
  }

  const montoTotal   = capital + totalInteres;
  const montoCuotaRef = cuotas[0]?.monto_total || 0;

  return {
    capital,
    tasa,
    tipo,
    numCuotas,
    frecuencia,
    totalInteres:    round2(totalInteres),
    montoTotal:      round2(montoTotal),
    montoCuota:      round2(montoCuotaRef),
    fechaVencimiento: cuotas[cuotas.length - 1]?.fecha_vence,
    cuotas,
  };
}

/**
 * Convertir tasa mensual a la tasa del período de pago
 */
function tasaPorFrecuencia(tasaMensual, frecuencia) {
  switch (frecuencia) {
    case 'diario':    return tasaMensual / 30;
    case 'semanal':   return tasaMensual / 4.33;
    case 'quincenal': return tasaMensual / 2;
    case 'mensual':   return tasaMensual;
    default:          return tasaMensual;
  }
}

/**
 * Calcular la fecha de vencimiento de una cuota
 */
function calcularFechaVence(fechaInicio, numeroCuota, frecuencia) {
  const fecha = new Date(fechaInicio + 'T00:00:00');

  switch (frecuencia) {
    case 'diario':
      fecha.setDate(fecha.getDate() + numeroCuota);
      break;
    case 'semanal':
      fecha.setDate(fecha.getDate() + (numeroCuota * 7));
      break;
    case 'quincenal':
      fecha.setDate(fecha.getDate() + (numeroCuota * 15));
      break;
    case 'mensual':
    default:
      fecha.setMonth(fecha.getMonth() + numeroCuota);
      break;
  }

  return fecha.toISOString().split('T')[0];
}

/**
 * Calcular mora acumulada para una cuota vencida
 * @param {number} saldoCuota   - Saldo pendiente de la cuota
 * @param {number} diasAtraso   - Días de atraso
 * @param {number} tasaMoraMensual - Tasa de mora mensual (ej: 0.02 = 2%)
 */
export function calcularMora(saldoCuota, diasAtraso, tasaMoraMensual = 0.02) {
  if (diasAtraso <= 0) return 0;
  const tasaDiaria = tasaMoraMensual / 30;
  return round2(saldoCuota * tasaDiaria * diasAtraso);
}

/**
 * Calcular días de atraso desde la fecha de vencimiento
 */
export function diasAtraso(fechaVence) {
  const hoy  = new Date(); hoy.setHours(0,0,0,0);
  const venc = new Date(fechaVence + 'T00:00:00');
  const diff = Math.floor((hoy - venc) / 86400000);
  return Math.max(0, diff);
}

/**
 * Resumen rápido para mostrar en el formulario (antes de guardar)
 */
export function resumenPlan(plan) {
  if (!plan) return null;
  return {
    montoCuota:      plan.montoCuota,
    totalInteres:    plan.totalInteres,
    montoTotal:      plan.montoTotal,
    fechaVencimiento: plan.fechaVencimiento,
    numCuotas:       plan.numCuotas,
  };
}

/**
 * Etiqueta legible de frecuencia
 */
export function labelFrecuencia(frecuencia) {
  const map = { diario: 'Diaria', semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual' };
  return map[frecuencia] || frecuencia;
}

/**
 * Próxima cuota pendiente de un préstamo
 */
export function proximaCuota(cuotas) {
  return cuotas
    .filter(c => ['pendiente','vencida','parcial'].includes(c.estado))
    .sort((a,b) => new Date(a.fecha_vence) - new Date(b.fecha_vence))[0] || null;
}

// Redondear a 2 decimales
function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}
