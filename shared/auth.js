// ============================================================
//  COBRIKA — Auth Module
//  shared/auth.js
// ============================================================
import { supabase } from './supabase-client.js';

// ── Obtener usuario y perfil completo ──────────────────────
export async function getUsuarioActual() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('*, tenants(*), configuracion:tenants(configuracion(*))')
    .eq('id', user.id)
    .single();

  if (!perfil) return null;
  return { ...user, perfil };
}

// ── Login ──────────────────────────────────────────────────
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// ── Logout ─────────────────────────────────────────────────
export async function logout() {
  await supabase.auth.signOut();
  window.location.href = location.origin + '/cobrika/index.html';
}

// ── Proteger rutas del panel admin ─────────────────────────
// Llama esta función al inicio de cada página del admin
export async function requireAdmin() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = location.origin + '/cobrika/index.html';
    return null;
  }

  const usuario = await getUsuarioActual();
  if (!usuario || !['admin','supervisor','cobrador'].includes(usuario.perfil?.rol)) {
    window.location.href = location.origin + '/cobrika/index.html';
    return null;
  }

  // Inyectar nombre y tenant en el header si existe
  const elNombre  = document.getElementById('admin-nombre');
  const elTenant  = document.getElementById('admin-tenant');
  const elAvatar  = document.getElementById('admin-avatar');
  if (elNombre)  elNombre.textContent  = usuario.perfil.nombre;
  if (elTenant)  elTenant.textContent  = usuario.perfil.tenants?.nombre || '';
  if (elAvatar)  elAvatar.textContent  = usuario.perfil.nombre.charAt(0).toUpperCase();

  return usuario;
}

// ── Guardar tenant_id en sessionStorage (acceso rápido) ───
export function getTenantId() {
  return sessionStorage.getItem('cobrika_tenant_id');
}

// ── Escuchar cambios de sesión ─────────────────────────────
export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}

// ── Helpers de rol ─────────────────────────────────────────
export function esAdmin(usuario) {
  return usuario?.perfil?.rol === 'admin';
}

export function esSupervisor(usuario) {
  return ['admin','supervisor'].includes(usuario?.perfil?.rol);
}
