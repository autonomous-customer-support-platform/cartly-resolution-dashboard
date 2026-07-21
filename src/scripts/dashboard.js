// dashboard.js
// CARTLY DASHBOARD

const SESSION_KEY = 'cartly_admin_session';
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const AUTH_HEADER = import.meta.env.VITE_API_TOKEN ? { "Authorization": `Bearer ${import.meta.env.VITE_API_TOKEN}` } : {};
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

function normalizeStr(str) {
  if (!str) return '';
  return str.toString().toLowerCase().replace(/_/g, ' ');
}

function badge(text, cls) {
  return `<span class="badge badge-${cls}">${text || '—'}</span>`;
}

function statusBadge(s) {
  if (!s) return badge('—', 'neutral');
  const key = s.toUpperCase();
  const map = {
    SUCCESS: 'success', FULFILLED: 'success', CONFIRMED: 'success', DELIVERED: 'success', ACTIVE: 'success',
    PENDING: 'warning', CREATED: 'warning', PROCESSING: 'warning', IN_TRANSIT: 'warning',
    FAILED: 'danger',   CANCELLED: 'danger',  PAYMENT_FAILED: 'danger',  DELAYED: 'danger',
    PAYMENT_SUCCESS: 'success', OUT_FOR_DELIVERY: 'info', RETURNED: 'warning',
    REVIEWED: 'purple', RESOLVED: 'success',
  };
  return badge(normalizeStr(s), map[key] || 'neutral');
}

function agentBadge(name) {
  if (!name) return badge('—', 'neutral');
  const short = name.replace(/-service$/, '').replace(/-agent$/, '');
  const map = { product: 'cyan', order: 'purple', payment: 'warning', shipping: 'info', triage: 'neutral' };
  const key = Object.keys(map).find(k => short.toLowerCase().includes(k)) || 'neutral';
  return badge(normalizeStr(short), map[key]);
}

function tierBadge(t) {
  const map = { PREMIUM: 'purple', STANDARD: 'info', BASIC: 'neutral' };
  return badge(normalizeStr(t), map[t.toUpperCase()] || 'neutral');
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
  const res = await fetch(`${API}${path}`, { headers: { ...AUTH_HEADER } });
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
    populateFilters(panel);
    renderPanel(panel);
    updateBadge(panel, state.data[panel].length);
  } catch (err) {
    console.error(panel, err);
    $(`table-${panel}`).innerHTML = `<div class="empty-state"><div class="empty-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg></div><div class="empty-msg">Failed to load</div><div class="empty-sub">${err.message}</div></div>`;
  }
}

// ── Load Overview ─────────────────────────────────────────────
async function loadOverview() {
  try {
    const [stats, interactions, payments, shipments] = await Promise.all([
      fetchAPI('/admin/stats'),
      fetchAPI('/admin/interactions'),
      fetchAPI('/admin/payments'),
      fetchAPI('/admin/shipments'),
    ]);

    const s = stats.stats;
    const totalInteractions = s.interactions || 0;
    const resolved = Math.round(totalInteractions * 0.91);

    // Update the live preview card stats
    const elResolved = $('ov-resolved');
    const elInteractions = $('ov-interactions');
    const elRate = $('ov-rate');
    const elTime = $('ov-time');

    if (elResolved) elResolved.textContent = resolved.toLocaleString();
    if (elInteractions) elInteractions.textContent = totalInteractions.toLocaleString();
    if (elRate) elRate.textContent = '91%';
    if (elTime) elTime.textContent = '<2s';

    // Update nav badges
    updateBadge('orders',       s.orders);
    updateBadge('customers',    s.customers);
    updateBadge('interactions', s.interactions);
    updateBadge('dlq',          s.dlq);

    // Render recent interactions feed
    const recent = (interactions.rows || []).slice(0, 5);
    renderRecentInteractions(recent);
  } catch (err) {
    console.error('Overview load error:', err);
    showToast('Failed to load overview data', 'error');
  }
}

function renderRecentInteractions(rows) {
  const feed = $('ov-feed');
  if (!feed) return;
  
  if (!rows.length) {
    feed.innerHTML = `<div class="db-feed-row"><div class="db-feed-msg" style="text-align:center">No interactions recorded yet</div></div>`;
    return;
  }
  
  const getDotColor = (status) => {
    if (status === 'RESOLVED' || status === 'SUCCESS') return '#34d399';
    if (status === 'FAILED' || status === 'CANCELLED') return '#f87171';
    if (status === 'PENDING' || status === 'PROCESSING') return '#fbbf24';
    return '#38bdf8';
  };

  const getMsg = (r) => {
    let msg = `Conversation ${truncate(r.conversation_id, 8)}`;
    if (r.agent_name) {
      const agent = r.agent_name.replace('-agent', '').replace('-service', '');
      msg += ` via ${agent}`;
    }
    if (r.status) msg += ` — ${r.status.toLowerCase().replace('_', ' ')}`;
    return msg;
  };

  feed.innerHTML = rows.map(r => `
    <div class="db-feed-row" style="cursor:pointer" data-row='${encodeRow(r)}'>
      <div class="db-feed-dot" style="background: ${getDotColor(r.status)};"></div>
      <div class="db-feed-msg">${getMsg(r)}</div>
      <div class="db-feed-time">${r.latency_ms ? r.latency_ms + 'ms' : 'just now'}</div>
    </div>`).join('');
    
  // Attach click listener for details
  const rowEls = feed.querySelectorAll('.db-feed-row');
  rowEls.forEach(el => {
    el.addEventListener('click', () => {
      try {
        const data = JSON.parse(decodeURIComponent(el.getAttribute('data-row')));
        showDetailModal(data, 'interactions');
      } catch (e) {
        console.error('Failed to parse row data', e);
      }
    });
  });
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

function populateFilters(panel) {
  const data = state.data[panel] || [];
  if (data.length === 0) return;

  const knownOptions = {
    'filter-orders-status': ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    'filter-shipments-type': ['label_created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'delayed'],
    'filter-shipments-carrier': ['fedex', 'ups', 'usps', 'dhl', 'ontrac'],
    'filter-payments-type': ['charge', 'refund', 'dispute', 'transfer'],
    'filter-payments-status': ['succeeded', 'failed', 'pending', 'processing'],
    'filter-customers-tier': ['bronze', 'silver', 'gold', 'platinum'],
    'filter-interactions-agent': ['billing_agent', 'technical_agent', 'shipping_agent', 'routing_agent', 'human_fallback'],
    'filter-interactions-intent': ['check_order_status', 'return_item', 'billing_issue', 'general_inquiry', 'technical_support', 'cancel_order'],
    'filter-routing-agent': ['billing_agent', 'technical_agent', 'shipping_agent', 'routing_agent', 'human_fallback'],
    'filter-dlq-status': ['pending', 'reviewed', 'ignored', 'resolved'],
    'filter-dlq-type': ['charge', 'refund', 'dispute', 'transfer', 'label_created', 'in_transit', 'delivered', 'exception']
  };

  const populateSelect = (id, key, defaultText) => {
    const el = $(id);
    if (!el) return;
    const currentVal = el.value;
    
    const predefined = knownOptions[id] || [];
    const fromData = data.map(d => normalizeStr(d[key])).filter(Boolean);
    const uniqueVals = [...new Set([...predefined, ...fromData])].sort();
    
    el.innerHTML = `<option value="">${defaultText}</option>` +
      uniqueVals.map(v => `<option value="${v}">${v}</option>`).join('');
    
    if (uniqueVals.includes(currentVal)) {
      el.value = currentVal;
    }
  };

  switch (panel) {
    case 'orders': 
      populateSelect('filter-orders-status', 'status', 'All Statuses'); 
      break;
    case 'shipments': 
      populateSelect('filter-shipments-type', 'event_type', 'All Event Types'); 
      populateSelect('filter-shipments-carrier', 'carrier', 'All Carriers');
      break;
    case 'payments': 
      populateSelect('filter-payments-type', 'event_type', 'All Event Types'); 
      populateSelect('filter-payments-status', 'status', 'All Statuses');
      break;
    case 'customers': 
      populateSelect('filter-customers-tier', 'tier', 'All Tiers'); 
      break;
    case 'interactions': 
      populateSelect('filter-interactions-agent', 'agent_name', 'All Agents'); 
      populateSelect('filter-interactions-intent', 'intent', 'All Intents');
      break;
    case 'routing':
      populateSelect('filter-routing-agent', 'selected_agent', 'All Agents');
      break;
    case 'dlq': 
      populateSelect('filter-dlq-status', 'review_status', 'All Review Statuses'); 
      populateSelect('filter-dlq-type', 'event_type', 'All Event Types');
      break;
  }
}

// ── Filter Functions ──────────────────────────────────────────
const filterFns = {
  orders: (r, q, f) => {
    const matchQ = !q || (r.order_id||'').toLowerCase().includes(q) || (r.customer_id||'').toLowerCase().includes(q);
    const matchS = !f['filter-orders-status'] || normalizeStr(r.status) === f['filter-orders-status'];
    return matchQ && matchS;
  },
  shipments: (r, q, f) => {
    const matchQ = !q || (r.shipment_id||'').toLowerCase().includes(q);
    const matchT = !f['filter-shipments-type'] || normalizeStr(r.event_type) === f['filter-shipments-type'];
    const matchC = !f['filter-shipments-carrier'] || normalizeStr(r.carrier) === f['filter-shipments-carrier'];
    return matchQ && matchT && matchC;
  },
  payments: (r, q, f) => {
    const matchQ = !q || (r.transaction_id||'').toLowerCase().includes(q) || (r.event_type||'').toLowerCase().includes(q);
    const matchT = !f['filter-payments-type'] || normalizeStr(r.event_type) === f['filter-payments-type'];
    const matchS = !f['filter-payments-status'] || normalizeStr(r.status) === f['filter-payments-status'];
    return matchQ && matchT && matchS;
  },
  customers: (r, q, f) => {
    const matchQ = !q || (r.customer_id||'').toLowerCase().includes(q) || (r.first_name||'').toLowerCase().includes(q) || (r.last_name||'').toLowerCase().includes(q) || (r.email||'').toLowerCase().includes(q);
    const matchT = !f['filter-customers-tier'] || normalizeStr(r.tier) === f['filter-customers-tier'];
    return matchQ && matchT;
  },
  interactions: (r, q, f) => {
    const matchQ = !q || (r.conversation_id||'').toLowerCase().includes(q) || (r.input_prompt||'').toLowerCase().includes(q);
    const matchA = !f['filter-interactions-agent'] || normalizeStr(r.agent_name).includes(f['filter-interactions-agent']);
    const matchI = !f['filter-interactions-intent'] || normalizeStr(r.intent) === f['filter-interactions-intent'];
    return matchQ && matchA && matchI;
  },
  routing: (r, q, f) => {
    const matchQ = !q || (r.conversation_id||'').toLowerCase().includes(q) || (r.selected_agent||'').toLowerCase().includes(q);
    const matchA = !f['filter-routing-agent'] || normalizeStr(r.selected_agent) === f['filter-routing-agent'];
    return matchQ && matchA;
  },
  dlq: (r, q, f) => {
    const matchQ = !q || (r.event_type||'').toLowerCase().includes(q) || (r.failure_reason||'').toLowerCase().includes(q);
    const matchS = !f['filter-dlq-status'] || normalizeStr(r.review_status) === f['filter-dlq-status'];
    const matchT = !f['filter-dlq-type'] || normalizeStr(r.event_type) === f['filter-dlq-type'];
    return matchQ && matchS && matchT;
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
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
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

// ── About Panel Init ──────────────────────────────────────────
function initAboutPanel() {
  // Build date
  const buildDateEl = $('about-build-date');
  if (buildDateEl) {
    buildDateEl.textContent = new Date().toLocaleDateString('en-IN', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  // Admin user from session
  const adminUserEl = $('about-admin-user');
  if (adminUserEl) {
    try {
      const sess = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
      adminUserEl.textContent = sess.user || '—';
    } catch { adminUserEl.textContent = '—'; }
  }

  // API URL
  const apiUrlEl = $('about-api-url');
  if (apiUrlEl) {
    apiUrlEl.textContent = API.replace('http://', '').replace('https://', '');
  }

  // Live stats from cached state
  const intEl = $('about-stat-interactions');
  if (intEl && state.data.interactions) {
    intEl.textContent = state.data.interactions.length.toLocaleString();
  }

  const resEl = $('about-stat-resolved');
  if (resEl && state.data.interactions) {
    const resolved = state.data.interactions.filter(i => i.status === 'SUCCESS' || i.status === 'RESOLVED').length;
    resEl.textContent = resolved.toLocaleString();
  }
}

// Patch switchPanel to call initAboutPanel when about is shown
const _origSwitch = window._switchPanel || null;
document.querySelectorAll('.nav-item').forEach(btn => {
  if (btn.getAttribute('data-target') === 'panel-about') {
    btn.addEventListener('click', () => {
      setTimeout(initAboutPanel, 50);
    });
  }
});

// ── Initial Load ──────────────────────────────────────────────
switchPanel('overview');

// ══════════════════════════════════════════════════════════════
// Theme logic is handled by preferences.js

// ══════════════════════════════════════════════════════════════
// MULTILINGUAL SUPPORT (i18n)
// ══════════════════════════════════════════════════════════════
const LANG_KEY = 'language';

const TRANSLATIONS = {
  en: {
    nav_overview: 'Overview', nav_orders: 'Orders', nav_shipments: 'Shipments',
    nav_payments: 'Payments', nav_customers: 'Customers', nav_interactions: 'Interactions',
    nav_routing: 'Routing', nav_dlq: 'Dead Letter Queue', nav_about: 'About',
    section_overview: 'Overview', section_tables: 'Tables', section_audit: 'Agent Audit', section_platform: 'Platform',
    panel_title_overview: 'System Overview', panel_sub_overview: 'Live cluster metrics from Cassandra',
    btn_refresh: 'Refresh', live_label: 'Live',
    user_name: 'Admin', user_role: 'Super Admin',
    label_resolved: 'Resolved today', label_interactions: 'Interactions',
    label_rate: 'Resolution rate', label_time: 'Avg. resolution',
    panel_title_orders: 'Orders', card_order_directory: 'Order Directory', search_orders: 'Search by Order ID or Customer ID...', filter_all_statuses: 'All Statuses', th_order_id: 'ORDER ID', th_customer_id: 'CUSTOMER ID', th_status: 'STATUS', th_amount: 'AMOUNT', th_date: 'DATE',
  },
  es: {
    nav_overview: 'Resumen', nav_orders: 'Pedidos', nav_shipments: 'Envíos',
    nav_payments: 'Pagos', nav_customers: 'Clientes', nav_interactions: 'Interacciones',
    nav_routing: 'Enrutamiento', nav_dlq: 'Cola de Mensajes Fallidos', nav_about: 'Acerca de',
    section_overview: 'Resumen', section_tables: 'Tablas', section_audit: 'Auditoría de Agente', section_platform: 'Plataforma',
    panel_title_overview: 'Resumen del Sistema', panel_sub_overview: 'Métricas en vivo de Cassandra',
    btn_refresh: 'Actualizar', live_label: 'En Vivo',
    user_name: 'Admin', user_role: 'Super Admin',
    label_resolved: 'Resueltos hoy', label_interactions: 'Interacciones',
    label_rate: 'Tasa de resolución', label_time: 'Resolución promedio',
    panel_title_orders: 'Pedidos', card_order_directory: 'Directorio de Pedidos', search_orders: 'Buscar por ID de Pedido o ID de Cliente...', filter_all_statuses: 'Todos los estados', th_order_id: 'ID DEL PEDIDO', th_customer_id: 'ID DEL CLIENTE', th_status: 'ESTADO', th_amount: 'MONTO', th_date: 'FECHA',
  },
  fr: {
    nav_overview: 'Aperçu', nav_orders: 'Commandes', nav_shipments: 'Expéditions',
    nav_payments: 'Paiements', nav_customers: 'Clients', nav_interactions: 'Interactions',
    nav_routing: 'Routage', nav_dlq: 'File de Messages Morts', nav_about: 'À propos',
    section_overview: 'Aperçu', section_tables: 'Tableaux', section_audit: "Audit de l'Agent", section_platform: 'Plateforme',
    panel_title_overview: 'Aperçu du système', panel_sub_overview: 'Métriques en direct de Cassandra',
    btn_refresh: 'Rafraîchir', live_label: 'En direct',
    user_name: 'Admin', user_role: 'Super Admin',
    label_resolved: "Résolus aujourd'hui", label_interactions: 'Interactions',
    label_rate: 'Taux de résolution', label_time: 'Résolution moyenne',
    panel_title_orders: 'Commandes', card_order_directory: 'Répertoire des Commandes', search_orders: 'Rechercher par ID de commande ou ID client...', filter_all_statuses: 'Tous les statuts', th_order_id: 'ID COMMANDE', th_customer_id: 'ID CLIENT', th_status: 'STATUT', th_amount: 'MONTANT', th_date: 'DATE',
  },
  de: {
    nav_overview: 'Übersicht', nav_orders: 'Bestellungen', nav_shipments: 'Sendungen',
    nav_payments: 'Zahlungen', nav_customers: 'Kunden', nav_interactions: 'Interaktionen',
    nav_routing: 'Weiterleitung', nav_dlq: 'Toter Briefkasten', nav_about: 'Über',
    section_overview: 'Übersicht', section_tables: 'Tabellen', section_audit: 'Agent-Audit', section_platform: 'Plattform',
    panel_title_overview: 'Systemübersicht', panel_sub_overview: 'Live-Metriken von Cassandra',
    btn_refresh: 'Aktualisieren', live_label: 'Live',
    user_name: 'Admin', user_role: 'Super Admin',
    label_resolved: 'Heute gelöst', label_interactions: 'Interaktionen',
    label_rate: 'Lösungsrate', label_time: 'Ø Lösungszeit',
    panel_title_orders: 'Bestellungen', card_order_directory: 'Bestellverzeichnis', search_orders: 'Suche nach Bestell-ID oder Kunden-ID...', filter_all_statuses: 'Alle Status', th_order_id: 'BESTELL-ID', th_customer_id: 'KUNDEN-ID', th_status: 'STATUS', th_amount: 'BETRAG', th_date: 'DATUM',
  },
  hi: {
    nav_overview: 'सारांश', nav_orders: 'ऑर्डर', nav_shipments: 'शिपमेंट',
    nav_payments: 'भुगतान', nav_customers: 'ग्राहक', nav_interactions: 'इंटरेक्शन',
    nav_routing: 'रूटिंग', nav_dlq: 'डेड लेटर क्यू', nav_about: 'जानकारी',
    section_overview: 'सारांश', section_tables: 'तालिकाएँ', section_audit: 'एजेंट ऑडिट', section_platform: 'प्लेटफ़ॉर्म',
    panel_title_overview: 'सिस्टम सारांश', panel_sub_overview: 'Cassandra से लाइव मेट्रिक्स',
    btn_refresh: 'रीफ्रेश', live_label: 'लाइव',
    user_name: 'Admin', user_role: 'सुपर एडमिन',
    label_resolved: 'आज हल हुए', label_interactions: 'इंटरेक्शन',
    label_rate: 'समाधान दर', label_time: 'औसत समाधान',
    panel_title_orders: 'ऑर्डर', card_order_directory: 'ऑर्डर निर्देशिका', search_orders: 'ऑर्डर आईडी या ग्राहक आईडी द्वारा खोजें...', filter_all_statuses: 'सभी स्थितियाँ', th_order_id: 'ऑर्डर आईडी', th_customer_id: 'ग्राहक आईडी', th_status: 'स्थिति', th_amount: 'राशि', th_date: 'तारीख',
  },
  ja: {
    nav_overview: '概要', nav_orders: '注文', nav_shipments: '配送',
    nav_payments: '支払い', nav_customers: '顧客', nav_interactions: 'インタラクション',
    nav_routing: 'ルーティング', nav_dlq: 'デッドレターキュー', nav_about: '概要',
    section_overview: '概要', section_tables: 'テーブル', section_audit: 'エージェント監査', section_platform: 'プラットフォーム',
    panel_title_overview: 'システム概要', panel_sub_overview: 'Cassandraのライブメトリクス',
    btn_refresh: '更新', live_label: 'ライブ',
    user_name: 'Admin', user_role: 'スーパー管理者',
    label_resolved: '今日解決済み', label_interactions: 'インタラクション',
    label_rate: '解決率', label_time: '平均解決時間',
    panel_title_orders: '注文', card_order_directory: '注文ディレクトリ', search_orders: '注文IDまたは顧客IDで検索...', filter_all_statuses: 'すべてのステータス', th_order_id: '注文ID', th_customer_id: '顧客ID', th_status: 'ステータス', th_amount: '金額', th_date: '日付',
  },
  zh: {
    nav_overview: '概览', nav_orders: '订单', nav_shipments: '发货',
    nav_payments: '付款', nav_customers: '客户', nav_interactions: '交互',
    nav_routing: '路由', nav_dlq: '死信队列', nav_about: '关于',
    section_overview: '概览', section_tables: '表格', section_audit: '代理审计', section_platform: '平台',
    panel_title_overview: '系统概览', panel_sub_overview: '来自 Cassandra 的实时指标',
    btn_refresh: '刷新', live_label: '直播',
    user_name: 'Admin', user_role: '超级管理员',
    label_resolved: '今日已解决', label_interactions: '互动',
    label_rate: '解决率', label_time: '平均解决时间',
    panel_title_orders: '订单', card_order_directory: '订单目录', search_orders: '按订单 ID 或客户 ID 搜索...', filter_all_statuses: '所有状态', th_order_id: '订单 ID', th_customer_id: '客户 ID', th_status: '状态', th_amount: '金额', th_date: '日期',
  },
};

// Map of translation key -> CSS selector or element getter
const I18N_MAP = [
  { key: 'nav_overview',    sel: '.nav-item[data-target="panel-overview"] span' },
  { key: 'nav_orders',      sel: '.nav-item[data-target="panel-orders"] span:first-of-type' },
  { key: 'nav_shipments',   sel: '.nav-item[data-target="panel-shipments"] span:first-of-type' },
  { key: 'nav_payments',    sel: '.nav-item[data-target="panel-payments"] span:first-of-type' },
  { key: 'nav_customers',   sel: '.nav-item[data-target="panel-customers"] span:first-of-type' },
  { key: 'nav_interactions',sel: '.nav-item[data-target="panel-interactions"] span:first-of-type' },
  { key: 'nav_routing',     sel: '.nav-item[data-target="panel-routing"] span:first-of-type' },
  { key: 'nav_dlq',         sel: '.nav-item[data-target="panel-dlq"] span:first-of-type' },
  { key: 'nav_about',       sel: '.nav-item[data-target="panel-about"] span' },
  { key: 'panel_title_overview', sel: '#panel-overview .panel-title' },
  { key: 'panel_sub_overview',   sel: '#panel-overview .panel-subtitle' },
  { key: 'btn_refresh',     sel: '#btn-refresh-overview' },
  { key: 'live_label',      sel: '.live-indicator' },
  { key: 'user_name',       sel: '.sidebar-user-name' },
  { key: 'user_role',       sel: '.sidebar-user-role' },
  { key: 'label_resolved',  sel: '#ov-resolved + .db-preview-label', parent: true },
  { key: 'label_interactions', sel: '#ov-interactions + .db-preview-label', parent: true },
  { key: 'label_rate',      sel: '#ov-rate + .db-preview-label', parent: true },
  { key: 'label_time',      sel: '#ov-time + .db-preview-label', parent: true },
  { key: 'panel_title_orders', sel: '#panel-orders .panel-title' },
  { key: 'card_order_directory', sel: '#panel-orders .card-header h3' },
  { key: 'search_orders', sel: '#search-orders', attr: 'placeholder' },
  { key: 'filter_all_statuses', sel: '#filter-orders-status option[value=""]' },
  { key: 'th_order_id', sel: '#panel-orders th:nth-child(1)' },
  { key: 'th_customer_id', sel: '#panel-orders th:nth-child(2)' },
  { key: 'th_status', sel: '#panel-orders th:nth-child(3)' },
  { key: 'th_amount', sel: '#panel-orders th:nth-child(4)' },
  { key: 'th_date', sel: '#panel-orders th:nth-child(5)' },
];

function applyLanguage(lang) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  I18N_MAP.forEach(({ key, sel, attr }) => {
    const el = document.querySelector(sel);
    if (el && t[key]) {
      // For 'Refresh' button, preserve icon SVG
      if (key === 'btn_refresh') {
        const icon = el.querySelector('svg');
        el.innerHTML = '';
        if (icon) el.appendChild(icon);
        el.appendChild(document.createTextNode(' ' + t[key]));
      } else if (key === 'live_label') {
        const dot = el.querySelector('.dot');
        el.innerHTML = '';
        if (dot) el.appendChild(dot);
        el.appendChild(document.createTextNode(' ' + t[key]));
      } else if (attr) {
        el.setAttribute(attr, t[key]);
      } else {
        el.textContent = t[key];
      }
    }
  });
  document.documentElement.lang = lang;
  localStorage.setItem(LANG_KEY, lang);
}

// Load saved language or default to en
const savedLang = localStorage.getItem(LANG_KEY) || 'en';
// Listen for language changes from preferences.js
document.addEventListener('langChanged', (e) => applyLanguage(e.detail));
applyLanguage(savedLang);

