// ============================================================
//  COBRIKA — Helpers / Utilidades
//  shared/helpers.js
// ============================================================

// ── Escape HTML (protección XSS) ───────────────────────────
// Usar SIEMPRE al interpolar datos de usuario en innerHTML
export function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Formato de moneda (RD$) ────────────────────────────────
export function formatMoney(amount) {
  if (amount == null || isNaN(amount)) return 'RD$ 0.00';
  return 'RD$ ' + Number(amount).toLocaleString('es-DO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Formato de fecha legible ───────────────────────────────
export function formatFecha(fecha, opciones = {}) {
  if (!fecha) return '—';
  const d = new Date(fecha + 'T00:00:00');
  return d.toLocaleDateString('es-DO', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
    ...opciones,
  });
}

// ── Días de diferencia entre hoy y una fecha ──────────────
export function diasDesde(fecha) {
  if (!fecha) return 0;
  const hoy  = new Date(); hoy.setHours(0,0,0,0);
  const otra = new Date(fecha + 'T00:00:00');
  return Math.floor((hoy - otra) / 86400000);
}

export function diasHasta(fecha) {
  return -diasDesde(fecha);
}

// ── Truncar texto ──────────────────────────────────────────
export function truncate(str, max = 30) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

// ── Capitalizar ────────────────────────────────────────────
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ── Iniciales de nombre ────────────────────────────────────
export function iniciales(nombre) {
  if (!nombre) return '?';
  return nombre.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

// ── Toast / notificación rápida ────────────────────────────
let toastContainer;

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      document.body.appendChild(toastContainer);
    }
  }
  return toastContainer;
}

export function toast(mensaje, tipo = 'info', duracion = 3500) {
  const iconos = {
    success: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>',
    error:   '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" d="M12 8v4m0 4h.01"/></svg>',
    warning: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M12 9v4m0 4h.01M10.29 3.86l-8.66 15A1 1 0 002.5 20.5h19a1 1 0 00.87-1.5l-8.66-15a1 1 0 00-1.74 0z"/></svg>',
    info:    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" d="M12 16v-4m0-4h.01"/></svg>',
  };

  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;
  el.innerHTML = `${iconos[tipo] || iconos.info} <span>${mensaje}</span>`;
  getToastContainer().appendChild(el);

  setTimeout(() => {
    el.style.animation = 'slideOut .25s ease forwards';
    setTimeout(() => el.remove(), 250);
  }, duracion);
}

// ── Confirmar acción ───────────────────────────────────────
export function confirmar(mensaje, titulo = '¿Estás seguro?') {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:400px">
        <div class="modal-header">
          <h3 style="font-size:1.1rem">${titulo}</h3>
        </div>
        <div class="modal-body">
          <p style="color:var(--gray-600)">${mensaje}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="conf-no">Cancelar</button>
          <button class="btn btn-danger"    id="conf-si">Confirmar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#conf-si').onclick = () => { overlay.remove(); resolve(true);  };
    overlay.querySelector('#conf-no').onclick = () => { overlay.remove(); resolve(false); };
    overlay.onclick = e => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
  });
}

// ── Debounce ───────────────────────────────────────────────
export function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Estado badge helper ────────────────────────────────────
const ESTADOS_PRESTAMO = {
  solicitado:   { label: 'Solicitado',   clase: 'badge-gray'    },
  en_revision:  { label: 'En revisión',  clase: 'badge-warning' },
  aprobado:     { label: 'Aprobado',     clase: 'badge-primary' },
  rechazado:    { label: 'Rechazado',    clase: 'badge-danger'  },
  activo:       { label: 'Activo',       clase: 'badge-primary' },
  al_dia:       { label: 'Al día',       clase: 'badge-success' },
  atrasado:     { label: 'Atrasado',     clase: 'badge-warning' },
  en_mora:      { label: 'En mora',      clase: 'badge-mora'    },
  saldado:      { label: 'Saldado',      clase: 'badge-success' },
  cancelado:    { label: 'Cancelado',    clase: 'badge-gray'    },
};

const ESTADOS_CLIENTE = {
  activo:   { label: 'Activo',   clase: 'badge-success' },
  moroso:   { label: 'Moroso',   clase: 'badge-mora'    },
  bloqueado:{ label: 'Bloqueado',clase: 'badge-danger'  },
  inactivo: { label: 'Inactivo', clase: 'badge-gray'    },
};

const ESTADOS_VOUCHER = {
  pendiente: { label: 'Pendiente', clase: 'badge-warning' },
  aprobado:  { label: 'Aprobado',  clase: 'badge-success' },
  rechazado: { label: 'Rechazado', clase: 'badge-danger'  },
};

export function badgePrestamo(estado) {
  const e = ESTADOS_PRESTAMO[estado] || { label: estado, clase: 'badge-gray' };
  return `<span class="badge ${e.clase}">${e.label}</span>`;
}

export function badgeCliente(estado) {
  const e = ESTADOS_CLIENTE[estado] || { label: estado, clase: 'badge-gray' };
  return `<span class="badge ${e.clase}">${e.label}</span>`;
}

export function badgeVoucher(estado) {
  const e = ESTADOS_VOUCHER[estado] || { label: estado, clase: 'badge-gray' };
  return `<span class="badge ${e.clase}">${e.label}</span>`;
}

// ── Generar número de recibo ───────────────────────────────
export function generarRecibo(prefijo = 'REC', numero) {
  return `${prefijo}-${String(numero).padStart(6, '0')}`;
}

// ── WhatsApp link ──────────────────────────────────────────
export function linkWhatsApp(telefono, mensaje) {
  const tel = telefono.replace(/\D/g, '');
  const tel1809 = tel.startsWith('1') ? tel : '1' + tel;
  return `https://wa.me/${tel1809}?text=${encodeURIComponent(mensaje)}`;
}

// ── Formatear teléfono RD ──────────────────────────────────
export function formatTel(tel) {
  if (!tel) return '—';
  const t = tel.replace(/\D/g, '');
  if (t.length === 10) return `(${t.slice(0,3)}) ${t.slice(3,6)}-${t.slice(6)}`;
  return tel;
}
