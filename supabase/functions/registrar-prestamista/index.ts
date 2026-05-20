// Edge Function: registrar-prestamista
// Crea un nuevo tenant, usuario admin y configuración inicial
// Llamada desde la página de registro público (sin autenticación)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { nombre_negocio, nombre_admin, email, password, telefono } = await req.json()

    // Validaciones básicas
    if (!nombre_negocio || !nombre_admin || !email || !password) {
      return new Response(JSON.stringify({ error: 'Faltan campos obligatorios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    if (password.length < 8) {
      return new Response(JSON.stringify({ error: 'La contraseña debe tener al menos 8 caracteres' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Cliente admin con SERVICE_ROLE
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SERVICE_ROLE_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. Verificar que el email no esté en uso
    const { data: usuariosExistentes } = await supabase.auth.admin.listUsers()
    const emailEnUso = usuariosExistentes?.users?.find(u => u.email === email)
    if (emailEnUso) {
      return new Response(JSON.stringify({ error: 'Este correo ya está registrado' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Crear tenant
    const fechaVence = new Date()
    fechaVence.setDate(fechaVence.getDate() + 30) // 30 días de prueba gratis

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        nombre:            nombre_negocio,
        email,
        telefono:          telefono || null,
        plan:              'basico',
        activo:            true,
        fecha_vencimiento: fechaVence.toISOString().split('T')[0],
        max_clientes:      50,
      })
      .select()
      .single()

    if (tenantError) throw tenantError

    // 3. Crear usuario en Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre: nombre_admin, tenant_id: tenant.id }
    })

    if (authError) {
      // Rollback: eliminar tenant creado
      await supabase.from('tenants').delete().eq('id', tenant.id)
      throw authError
    }

    // 4. Crear perfil de usuario en tabla usuarios
    const { error: usuarioError } = await supabase.from('usuarios').insert({
      id:        authUser.user.id,
      tenant_id: tenant.id,
      nombre:    nombre_admin,
      email,
      rol:       'admin',
      activo:    true,
    })

    if (usuarioError) throw usuarioError

    // 5. Actualizar owner_id del tenant
    await supabase.from('tenants').update({ owner_id: authUser.user.id }).eq('id', tenant.id)

    // 6. Crear configuración inicial
    await supabase.from('configuracion').insert({
      tenant_id:              tenant.id,
      nombre_negocio,
      moneda:                 'DOP',
      telefono_whatsapp:      telefono || null,
      tasa_interes_default:   0.10,
      tipo_interes_default:   'fijo',
      tasa_mora_default:      0.02,
      dias_gracia_default:    3,
      frecuencia_default:     'mensual',
      prefijo_recibo:         'REC',
      siguiente_recibo:       1,
      mensaje_recordatorio:   '¡Hola {nombre}! Le recordamos que su cuota de RD${monto} vence el {fecha}. Por favor realice su pago a tiempo. Gracias 🙏',
      mensaje_mora:           '¡Hola {nombre}! Su préstamo tiene {dias} días de atraso. Monto pendiente: RD${monto}. Por favor contáctenos. 📞',
    })

    return new Response(JSON.stringify({
      success: true,
      mensaje: `Cuenta creada exitosamente. Tienes 30 días de prueba gratis.`,
      tenant_id: tenant.id,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
