// dashboard.js
// CARTLY DASHBOARD

const SESSION_KEY = 'cartly_admin_session';
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const PAGE_SIZE = 15;

// ── Auth Guard ────────────────────────────────────────────────
const session = localStorage.getItem(SESSION_KEY);
if (!session) window.location.href = '/';

// ── State ─────────────────────────────────────────────────────
const state = {
  panel: 'overview',
  data: {},
  filtered: {},
  page: {},
};

// ── DOM Refs ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Utility Helpers ───────────────────────────────────────────
function fmt(v) {
  if (!v) return '—';
  if (typeof v === 'string' && v.match(/^\d{4}-\d{2}-\d{2}T/)) {
    return new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  }
  if (typeof v === 'object' && v.days_from_epoch) {
    return new Date(v.days_from_epoch * 86400000).toLocaleDateString('en-IN');
  }
  return v;
}

function fmtConf(v) {
  if (v == null) return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return v;
  return `${(n * 100).toFixed(0)}%`;
}

function truncate(str, len = 36) {
  if (!str) return '—';
  return str.length > len ? str.substring(0, len) + '…' : str;
}

function badge(text, cls) {
  return `<span class="badge badge-${cls}">${text || '—'}</span>`;
}

function statusBadge(s) {
  if (!s) return badge('—', 'neutral');
  const map = {
    SUCCESS: 'success', FULFILLED: 'success', CONFIRMED: 'success', DELIVERED: 'success', ACTIVE: 'success',
    PENDING: 'warning', CREATED: 'warning', PROCESSING: 'warning', IN_TRANSIT: 'warning',
    FAILED: 'danger',   CANCELLED: 'danger',  PAYMENT_FAILED: 'danger',  DELAYED: 'danger',
    PAYMENT_SUCCESS: 'success', OUT_FOR_DELIVERY: 'info', RETURNED: 'warning',
    REVIEWED: 'purple', RESOLVED: 'success',
  };
  return badge(s, map[s] || 'neutral');
}

function agentBadge(name) {
  if (!name) return badge('—', 'neutral');
  const short = name.replace(/-service$/, '').replace(/-agent$/, '').toUpperCase();
  const map = { product: 'cyan', order: 'purple', payment: 'warning', shipping: 'info', triage: 'neutral' };
  const key = Object.keys(map).find(k => short.toLowerCase().includes(k)) || 'neutral';
  return badge(short, map[key]);
}

function tierBadge(t) {
  const map = { PREMIUM: 'purple', STANDARD: 'info', BASIC: 'neutral' };
  return badge(t, map[t] || 'neutral');
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const container = $('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  const colors = { info: '#38bdf8', success: '#34d399', error: '#f87171' };
  toast.style.borderLeftColor = colors[type] || colors.info;
  toast.textContent = msg;
  container.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── API Fetch ─────────────────────────────────────────────────
async function fetchAPI(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Load Specific Panel Data ───────────────────────────────────
async function loadPanel(panel) {
  const endpointMap = {
    orders:       '/admin/orders',
    shipments:    '/admin/shipments',
    payments:     '/admin/payments',
    customers:    '/admin/customers',
    interactions: '/admin/interactions',
    routing:      '/admin/routing',
    dlq:          '/admin/dlq',
  };

  if (panel === 'overview') {
    return loadOverview();
  }

  const endpoint = endpointMap[panel];
  if (!endpoint) return;

  try {
    const data = await fetchAPI(endpoint);
    state.data[panel] = data.rows || [];
    state.filtered[panel] = [...state.data[panel]];
    state.page[panel] = 1;
    renderPanel(panel);
    updateBadge(panel, state.data[panel].length);
  } catch (err) {
    console.error(panel, err);
    $(`table-${panel}`).innerHTML = `<div class="empty-state"><div class="empty-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg></div><div class="empty-msg">Failed to load</div><div class="empty-sub">${err.message}</div></div>`;
  }
}

// ── Load Overview ─────────────────────────────────────────────
async function loadOverview() {
  const wrap = $('overview-stats');
  wrap.innerHTML = `<div class="stat-card glass-card">Loading...</div>`;
  
  try {
    const [stats, interactions, payments, shipments] = await Promise.all([
      fetchAPI('/admin/stats'),
      fetchAPI('/admin/interactions'),
      fetchAPI('/admin/payments'),
      fetchAPI('/admin/shipments'),
    ]);

    const s = stats.stats;
    const pRows = payments.rows || [];
    const failed = pRows.filter(r => r.event_type === 'PAYMENT_FAILED').length;

    wrap.innerHTML = `
      <div class="stat-card glass-card">
        <div class="stat-title">Total Orders</div>
        <div class="stat-value">${(s.orders ?? '—').toLocaleString()}</div>
      </div>
      <div class="stat-card glass-card">
        <div class="stat-title">Customers</div>
        <div class="stat-value">${(s.customers ?? '—').toLocaleString()}</div>
      </div>
      <div class="stat-card glass-card">
        <div class="stat-title">Interactions</div>
        <div class="stat-value">${(s.interactions ?? '—').toLocaleString()}</div>
      </div>
      <div class="stat-card glass-card">
        <div class="stat-title">DLQ Size</div>
        <div class="stat-value text-danger">${(s.dlq ?? '—').toLocaleString()}</div>
      </div>
      <div class="stat-card glass-card">
        <div class="stat-title">Failed Payments</div>
        <div class="stat-value">${failed}</div>
      </div>
      <div class="stat-card glass-card">
        <div class="stat-title">Active Shipments</div>
        <div class="stat-value">${(shipments.rows || []).length}</div>
      </div>
    `;

    updateBadge('orders',       s.orders);
    updateBadge('customers',    s.customers);
    updateBadge('interactions', s.interactions);
    updateBadge('dlq',          s.dlq);

    // Render recent interactions table
    const recent = (interactions.rows || []).slice(0, 8);
    renderRecentInteractions(recent);
  } catch (err) {
    console.error('Overview load error:', err);
    showToast('Failed to load overview data', 'error');
  }
}

function renderRecentInteractions(rows) {
  const tbody = document.querySelector('#overview-table tbody');
  if (!tbody) return;
  
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center" style="padding: 32px">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" style="margin: 0 auto 12px; display: block;"><path d="M12 2a2 2 0 0 1 2 2c-.74 1.4-1.74 3.4-2 5h4l-2.6 6.4c-.42 1-.94 2.2-1.4 3.6A2 2 0 0 1 12 22a2 2 0 0 1-2-2c.74-1.4 1.74-3.4 2-5H8l2.6-6.4c.42-1 .94-2.2 1.4-3.6A2 2 0 0 1 12 2z"></path></svg>
      <div class="empty-msg">No interactions recorded yet</div>
    </td></tr>`;
    return;
  }
  
  tbody.innerHTML = rows.map(r => `
    <tr data-row='${encodeRow(r)}'>
      <td class="mono">${truncate(r.conversation_id, 20)}</td>
      <td>${agentBadge(r.agent_name)}</td>
      <td>${statusBadge(r.status)}</td>
      <td>${r.latency_ms ? r.latency_ms + ' ms' : '—'}</td>
    </tr>`).join('');
    
  attachRowClick($('overview-table'));
}

// ── Panel Definitions ─────────────────────────────────────────
const PANELS = {
  orders: {
    cols: [
      { k: 'order_id',    label: 'Order ID',    mono: true, trim: 20 },
      { k: 'customer_id', label: 'Customer',    mono: true, trim: 18 },
      { k: 'status',      label: 'Status',      badge: statusBadge },
      { k: 'order_total', label: 'Total' },
      { k: 'placed_at',   label: 'Placed At',   fmt: fmt },
    ],
  },
  shipments: {
    cols: [
      { k: 'shipment_id',  label: 'Shipment ID',  mono: true, trim: 18 },
      { k: 'event_type',   label: 'Event',         badge: statusBadge },
      { k: 'location',     label: 'Location' },
      { k: 'status_code',  label: 'Code',          mono: true },
      { k: 'event_time',   label: 'Event Time',    fmt: fmt },
    ],
  },
  payments: {
    cols: [
      { k: 'transaction_id',  label: 'Transaction ID', mono: true, trim: 20 },
      { k: 'event_type',      label: 'Event',          badge: statusBadge },
      { k: 'previous_status', label: 'Prev Status' },
      { k: 'new_status',      label: 'New Status',     badge: statusBadge },
      { k: 'actor',           label: 'Actor',          mono: true },
      { k: 'event_time',      label: 'Event Time',     fmt: fmt },
    ],
  },
  customers: {
    cols: [
      { k: 'customer_id',        label: 'Customer ID',  mono: true, trim: 18 },
      { k: 'first_name',         label: 'First Name' },
      { k: 'email',              label: 'Email' },
      { k: 'tier',               label: 'Tier',         badge: tierBadge },
      { k: 'created_at',         label: 'Created',      fmt: fmt },
    ],
  },
  interactions: {
    cols: [
      { k: 'conversation_id',   label: 'Conversation',  mono: true, trim: 18 },
      { k: 'agent_name',        label: 'Agent',          badge: agentBadge },
      { k: 'status',            label: 'Status',         badge: statusBadge },
      { k: 'latency_ms',        label: 'Latency',        fmt: v => v ? `${v} ms` : '—' },
      { k: 'routing_confidence',label: 'Confidence',     fmt: fmtConf },
      { k: 'input_prompt',      label: 'Prompt',         trim: 60 },
    ],
  },
  routing: {
    cols: [
      { k: 'conversation_id', label: 'Conversation',  mono: true, trim: 18 },
      { k: 'selected_agent',  label: 'Selected Agent', badge: agentBadge },
      { k: 'confidence',      label: 'Confidence',     fmt: fmtConf },
      { k: 'detected_language', label: 'Language' },
    ],
  },
  dlq: {
    cols: [
      { k: 'dlq_id',        label: 'DLQ ID',        mono: true, trim: 18 },
      { k: 'event_type',    label: 'Event Type' },
      { k: 'source_topic',  label: 'Source Topic' },
      { k: 'failure_count', label: 'Failures' },
      { k: 'review_status', label: 'Review',        badge: statusBadge },
      { k: 'last_failed_at', label: 'Last Failed', fmt: fmt },
    ],
  },
};

// ── Render Panel ──────────────────────────────────────────────
function renderPanel(panel) {
  const rows = state.filtered[panel] || [];
  const page = state.page[panel] || 1;
  const cols = PANELS[panel].cols;
  const wrap = $(`table-${panel}`);
  const tbody = wrap.querySelector('tbody');
  const pager = $(`pagination-${panel}`);

  if (!rows.length) {
    const colCount = wrap.querySelectorAll('thead th').length || cols.length;
    tbody.innerHTML = `<tr><td colspan="${colCount}" class="text-center" style="padding: 48px">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5" style="margin: 0 auto 16px; display: block;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
      <div class="empty-msg">No records found</div>
      <div class="empty-sub">Try adjusting your search or filters</div>
    </td></tr>`;
    if (pager) pager.innerHTML = '';
    return;
  }

  const start = (page - 1) * PAGE_SIZE;
  const pageRows = rows.slice(start, start + PAGE_SIZE);
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);

  tbody.innerHTML = pageRows.map(r => {
    const cells = cols.map(c => {
      const raw = r[c.k];
      let cell;
      if (c.badge) {
        cell = c.badge(raw);
      } else if (c.fmt) {
        cell = c.fmt(raw) ?? '—';
      } else if (c.trim) {
        cell = `<span title="${raw || ''}">${truncate(raw, c.trim)}</span>`;
      } else {
        cell = raw ?? '—';
      }
      return `<td class="${c.mono ? 'mono' : ''}">${cell}</td>`;
    }).join('');
    return `<tr data-row='${encodeRow(r)}'>${cells}</tr>`;
  }).join('');

  attachRowClick(wrap);

  if (pager) {
    pager.innerHTML = `
      <span class="pager-info">${start + 1}–${Math.min(start + PAGE_SIZE, rows.length)} of ${rows.length}</span>
      <div class="pager-controls">
        <button class="pager-btn" id="prev-${panel}" ${page === 1 ? 'disabled' : ''}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <span class="pager-page">${page} / ${totalPages}</span>
        <button class="pager-btn" id="next-${panel}" ${page === totalPages ? 'disabled' : ''}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </div>`;
    $(`prev-${panel}`)?.addEventListener('click', () => { state.page[panel]--; renderPanel(panel); });
    $(`next-${panel}`)?.addEventListener('click', () => { state.page[panel]++; renderPanel(panel); });
  }
}

// ── Row Click → Detail Modal ──────────────────────────────────
function encodeRow(r) {
  return encodeURIComponent(JSON.stringify(r));
}

function attachRowClick(wrap) {
  wrap.querySelectorAll('tbody tr').forEach(tr => {
    if (!tr.dataset.row) return;
    tr.addEventListener('click', () => {
      try {
        const r = JSON.parse(decodeURIComponent(tr.dataset.row));
        const cardsHtml = Object.entries(r).map(([k, v]) => {
          const formattedKey = k.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          let val = v;
          if (val === null || val === undefined) val = '—';
          else if (typeof val === 'object') val = JSON.stringify(val);
          return `<div class="detail-card"><div class="detail-label">${formattedKey}</div><div class="detail-value">${val}</div></div>`;
        }).join('');
        $('detail-modal-content').innerHTML = cardsHtml;
        $('detail-modal').classList.remove('hidden');
      } catch(e) { console.error(e); }
    });
  });
}

// Close detail modal
$('btn-close-detail').addEventListener('click', () => $('detail-modal').classList.add('hidden'));
$('detail-modal').addEventListener('click', e => { if (e.target === $('detail-modal')) $('detail-modal').classList.add('hidden'); });

// ── Badge Update ──────────────────────────────────────────────
function updateBadge(panel, count) {
  const el = $(`badge-${panel}`);
  if (el) el.textContent = count ?? '—';
}

// ── Search & Filter ───────────────────────────────────────────
function setupSearch(panel, filterFn) {
  const searchEl = $(`search-${panel}`);
  if (!searchEl) return;
  searchEl.addEventListener('input', () => applyFilter(panel, filterFn));

  // Also listen to filter dropdowns
  document.querySelectorAll(`[id^="filter-${panel}"]`).forEach(el => {
    el.addEventListener('change', () => applyFilter(panel, filterFn));
  });
}

function applyFilter(panel, filterFn) {
  const searchEl = $(`search-${panel}`);
  const q = searchEl ? searchEl.value.toLowerCase() : '';
  const filters = {};
  document.querySelectorAll(`[id^="filter-${panel}"]`).forEach(el => {
    filters[el.id] = el.value;
  });

  state.filtered[panel] = (state.data[panel] || []).filter(r => filterFn(r, q, filters));
  state.page[panel] = 1;
  renderPanel(panel);
}

// ── Filter Functions ──────────────────────────────────────────
const filterFns = {
  orders: (r, q, f) => {
    const matchQ = !q || (r.order_id||'').toLowerCase().includes(q) || (r.customer_id||'').toLowerCase().includes(q);
    const matchS = !f['filter-orders-status'] || r.status === f['filter-orders-status'];
    return matchQ && matchS;
  },
  shipments: (r, q, f) => {
    const matchQ = !q || (r.shipment_id||'').toLowerCase().includes(q);
    const matchT = !f['filter-shipments-type'] || r.event_type === f['filter-shipments-type'];
    return matchQ && matchT;
  },
  payments: (r, q, f) => {
    const matchQ = !q || (r.transaction_id||'').toLowerCase().includes(q) || (r.event_type||'').toLowerCase().includes(q);
    const matchT = !f['filter-payments-type'] || r.event_type === f['filter-payments-type'];
    return matchQ && matchT;
  },
  customers: (r, q, f) => {
    const matchQ = !q || (r.customer_id||'').toLowerCase().includes(q) || (r.first_name||'').toLowerCase().includes(q) || (r.last_name||'').toLowerCase().includes(q) || (r.email||'').toLowerCase().includes(q);
    const matchT = !f['filter-customers-tier'] || r.tier === f['filter-customers-tier'];
    return matchQ && matchT;
  },
  interactions: (r, q, f) => {
    const matchQ = !q || (r.conversation_id||'').toLowerCase().includes(q) || (r.input_prompt||'').toLowerCase().includes(q);
    const matchA = !f['filter-interactions-agent'] || (r.agent_name||'').includes(f['filter-interactions-agent']);
    return matchQ && matchA;
  },
  routing: (r, q, f) => {
    const matchQ = !q || (r.conversation_id||'').toLowerCase().includes(q) || (r.selected_agent||'').toLowerCase().includes(q);
    return matchQ;
  },
  dlq: (r, q, f) => {
    const matchQ = !q || (r.event_type||'').toLowerCase().includes(q) || (r.failure_reason||'').toLowerCase().includes(q);
    const matchS = !f['filter-dlq-status'] || r.review_status === f['filter-dlq-status'];
    return matchQ && matchS;
  },
};

// ── Event Trigger Modal ────────────────────────────────────────
let triggerType = null;

const paymentEventTypes  = ['PAYMENT_FAILED', 'PAYMENT_SUCCESS', 'REFUND_INITIATED'];
const shipmentEventTypes = ['SHIPMENT_DELAYED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED'];

function openTriggerModal(type) {
  triggerType = type;
  const isPayment = type === 'payment';
  $('trigger-modal-title').textContent = isPayment ? 'Trigger Payment Event' : 'Trigger Shipment Event';
  const evtSel = $('trigger-event-type');
  const options = isPayment ? paymentEventTypes : shipmentEventTypes;
  evtSel.innerHTML = options.map(o => `<option value="${o}">${o}</option>`).join('');
  $('trigger-customer-id').value = '11111111-1111-1111-1111-111111111111';
  $('trigger-modal').classList.remove('hidden');
}

const triggerPayBtn = $('btn-open-trigger-payment');
if (triggerPayBtn) triggerPayBtn.addEventListener('click',  () => openTriggerModal('payment'));

const triggerShipBtn = $('btn-open-trigger-shipment');
if (triggerShipBtn) triggerShipBtn.addEventListener('click', () => openTriggerModal('shipment'));

$('btn-close-trigger').addEventListener('click', () => $('trigger-modal').classList.add('hidden'));
$('btn-cancel-trigger').addEventListener('click', () => $('trigger-modal').classList.add('hidden'));
$('trigger-modal').addEventListener('click', e => { if (e.target === $('trigger-modal')) $('trigger-modal').classList.add('hidden'); });

$('form-trigger').addEventListener('submit', async (e) => {
  e.preventDefault();
  const customerId = $('trigger-customer-id').value.trim();
  const eventType  = $('trigger-event-type').value;
  const submitBtn  = $('form-trigger').querySelector('button[type="submit"]');

  if (!customerId) return;

  submitBtn.disabled = true;
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = 'Sending...';

  try {
    const endpoint = triggerType === 'payment' ? '/test/payment-event' : '/test/shipment-event';
    const res = await fetch(`${API}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customerId, event_type: eventType }),
    });
    
    if (res.ok) {
      showToast(`${eventType} triggered successfully`, 'success');
      $('trigger-modal').classList.add('hidden');
      
      // Refresh the relevant panel after 1.5s
      setTimeout(() => {
        const targetPanel = triggerType === 'payment' ? 'payments' : 'shipments';
        loadPanel(targetPanel);
      }, 1500);
    } else {
      throw new Error('Trigger failed');
    }
  } catch (err) {
    showToast(`Failed: ${err.message}`, 'error');
  } finally {
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
});

// ── Sidebar Navigation ─────────────────────────────────────────

function switchPanel(panel) {
  // Hide all panels, deactivate all nav items
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Show selected
  const panelEl = $(`panel-${panel}`);
  if (panelEl) panelEl.classList.add('active');
  const navEl = document.querySelector(`.nav-item[data-target="panel-${panel}"]`);
  if (navEl) navEl.classList.add('active');

  state.panel = panel;

  // Load data if not cached
  if (!state.data[panel] && panel !== 'overview') {
    loadPanel(panel);
  } else if (panel === 'overview') {
    loadOverview();
  }
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const target = item.dataset.target;
    if (target && target.startsWith('panel-')) {
      switchPanel(target.replace('panel-', ''));
    }
  });
});

// ── Refresh Button ─────────────────────────────────────────────
document.querySelectorAll('.refresh-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const panel = btn.dataset.table;
    delete state.data[panel];
    loadPanel(panel);
    showToast('Table refreshed', 'success');
  });
});

const refOverview = $('btn-refresh-overview');
if (refOverview) {
  refOverview.addEventListener('click', () => {
    loadOverview();
    showToast('Overview refreshed', 'success');
  });
}

// ── Auto-Refresh Every 30s ────────────────────────────────────
setInterval(() => {
  if (state.panel === 'overview') loadOverview();
}, 30000);

// ── Logout ────────────────────────────────────────────────────
$('btn-logout').addEventListener('click', () => {
  localStorage.removeItem(SESSION_KEY);
  window.location.href = '/';
});

// ── Setup Search & Filters ────────────────────────────────────
Object.keys(filterFns).forEach(panel => setupSearch(panel, filterFns[panel]));

// ── Initial Load ──────────────────────────────────────────────
switchPanel('overview');
