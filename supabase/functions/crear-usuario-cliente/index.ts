// Edge Function: crear-usuario-cliente
// Crea un usuario en Supabase Auth con cliente_id en metadata
// Solo puede ser llamada por usuarios autenticados con rol admin

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verificar que quien llama es un admin autenticado
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Cliente con la clave del usuario (para verificar que es admin)
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verificar sesión y rol
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Sesión inválida' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verificar que es admin o supervisor
    const { data: perfil } = await supabaseUser
      .from('usuarios')
      .select('rol, tenant_id')
      .eq('id', user.id)
      .single()

    if (!perfil || !['admin', 'supervisor'].includes(perfil.rol)) {
      return new Response(JSON.stringify({ error: 'Sin permisos' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Obtener datos del body
    const { email, password, cliente_id, nombre } = await req.json()

    if (!email || !password || !cliente_id || !nombre) {
      return new Response(JSON.stringify({ error: 'Faltan datos: email, password, cliente_id, nombre' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'La contraseña debe tener al menos 6 caracteres' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verificar que el cliente pertenece al mismo tenant
    const { data: cliente, error: clienteError } = await supabaseUser
      .from('clientes')
      .select('id, nombre, tenant_id')
      .eq('id', cliente_id)
      .eq('tenant_id', perfil.tenant_id)
      .single()

    if (clienteError || !cliente) {
      return new Response(JSON.stringify({ error: 'Cliente no encontrado en tu organización' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 3. Crear usuario con SERVICE_ROLE (privilegios admin)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SERVICE_ROLE_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verificar si el email ya existe
    const { data: existentes } = await supabaseAdmin.auth.admin.listUsers()
    const yaExiste = existentes?.users?.find(u => u.email === email)

    if (yaExiste) {
      // Si ya existe, actualizar sus metadatos
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        yaExiste.id,
        { user_metadata: { cliente_id, nombre } }
      )
      if (updateError) throw updateError

      return new Response(JSON.stringify({
        success: true,
        mensaje: 'Usuario actualizado con acceso al cliente',
        user_id: yaExiste.id
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Crear nuevo usuario
    const { data: nuevoUsuario, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // confirmar email automáticamente
      user_metadata: { cliente_id, nombre }
    })

    if (createError) throw createError

    return new Response(JSON.stringify({
      success: true,
      mensaje: `Acceso creado para ${nombre}`,
      user_id: nuevoUsuario.user.id
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
