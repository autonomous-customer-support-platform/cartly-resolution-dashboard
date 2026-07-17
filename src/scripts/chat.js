// chat.js
// CARTLY CUSTOMER CHAT — Database-Backed Sessions

const SESSION_KEY = 'cartly_user_session';
const ACTIVE_SESSION_KEY = 'cartly_active_session';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// ── Auth Guard ────────────────────────────────────────────────
const sessionRaw = localStorage.getItem(SESSION_KEY);
if (!sessionRaw) window.location.href = '/';
const session = JSON.parse(sessionRaw);

// ── State ─────────────────────────────────────────────────────
let currentSessionId = null;
let isPolling = false;
let sendLock = false;
let activeSessions = [];

// ── DOM Refs ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const chatHistory = $('chat-history');
const chatInput = $('chat-input');
const btnSend = $('btn-send');
const sessionsList = $('sessions-list');

// ── Init Profile ──────────────────────────────────────────────
function initProfile() {
  const name = session.name || 'User';
  $('user-name').textContent = name;
  $('user-email').textContent = session.email || '\u2014';
  $('user-avatar').textContent = name.charAt(0).toUpperCase();
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const container = $('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  const colors = { info: '#38bdf8', success: '#34d399', error: '#f87171' };
  toast.style.borderLeftColor = colors[type] || colors.info;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

// ── Chat UI Helpers ───────────────────────────────────────────
function formatTime(ts) {
  return new Date(ts || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function appendMessage(text, sender, ts = null) {
  const wrapper = document.createElement('div');
  wrapper.className = `message ${sender}`;
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  const rawText = typeof text === 'object' ? JSON.stringify(text, null, 2) : text;
  
  if (sender === 'agent' && typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
    bubble.innerHTML = DOMPurify.sanitize(marked.parse(rawText));
  } else {
    bubble.textContent = rawText;
  }
  const time = document.createElement('div');
  time.className = 'message-time';
  time.textContent = formatTime(ts);
  wrapper.appendChild(bubble);
  wrapper.appendChild(time);
  chatHistory.appendChild(wrapper);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function showTyping() {
  const el = document.createElement('div');
  el.className = 'message agent';
  el.id = 'typing-indicator';
  el.innerHTML = '<div class="message-bubble typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
  chatHistory.appendChild(el);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function hideTyping() {
  const el = $('typing-indicator');
  if (el) el.remove();
}

function updateTopbar(title) {
  const topbar = document.querySelector('.chat-topbar h2');
  if (topbar) topbar.textContent = (!title || title === 'New Chat') ? 'Customer Support' : title;
}

// ── API Interaction ───────────────────────────────────────────

async function fetchSessions() {
  try {
    const res = await fetch(`${API_URL}/chat/sessions/${session.customer_id || session.email}`);
    if (res.ok) {
      const data = await res.json();
      
      // Merge titles to prevent overwriting an optimistic initial title with a slow backend "New Chat"
      if (data.sessions) {
        data.sessions.forEach(ds => {
          const existing = activeSessions.find(s => s.id === ds.id);
          if (existing && existing.title && existing.title !== 'New Chat' && ds.title === 'New Chat') {
            ds.title = existing.title;
          }
        });
        activeSessions = data.sessions;
      } else {
        activeSessions = [];
      }
      
      renderSessions();
      
      // If we don't have a current session but we fetched some, pick the first
      if (!currentSessionId) {
        if (activeSessions.length > 0) {
          // Fallback to active session from localStorage if it exists in the list
          const savedId = localStorage.getItem(ACTIVE_SESSION_KEY);
          if (savedId && activeSessions.find(s => s.id === savedId)) {
            switchSession(savedId);
          } else {
            switchSession(activeSessions[0].id);
          }
        } else {
          createNewSession();
        }
      }
    }
  } catch (err) {
    console.error("Failed to load sessions:", err);
  }
}

async function loadHistory(id) {
  chatHistory.innerHTML = '';
  try {
    const res = await fetch(`${API_URL}/chat/history/${id}`);
    if (res.ok) {
      const data = await res.json();
      const history = data.history || [];
      if (history.length === 0) {
        appendMessage("Hi! I'm Cartly's autonomous support assistant. How can I help you today?", 'agent');
      } else {
        history.forEach(m => appendMessage(m.text, m.sender, m.ts));
      }
    } else {
      appendMessage("Hi! I'm Cartly's autonomous support assistant. How can I help you today?", 'agent');
    }
  } catch (err) {
    console.error("Failed to load history:", err);
    appendMessage("Hi! I'm Cartly's autonomous support assistant. How can I help you today?", 'agent');
  }
}

async function sendMessage(text) {
  if (!text || sendLock) return;
  sendLock = true;
  btnSend.disabled = true;

  // We immediately add it to the UI
  appendMessage(text, 'user');
  showTyping();
  
  // If this is a brand new session, the API will create it. We can optimistic update the title.
  const isNewSession = !activeSessions.find(s => s.id === currentSessionId);
  if (isNewSession) {
    const words = text.trim().split(/\s+/);
    const title = words.slice(0, 6).join(' ') + (words.length > 6 ? '\u2026' : '');
    activeSessions.unshift({ id: currentSessionId, title: title });
    renderSessions();
    updateTopbar(title);
  }

  try {
    const res = await fetch(`${API_URL}/chat/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: currentSessionId,
        customer_id: session.customer_id || session.email,
        query: text,
      }),
    });
    if (!res.ok) throw new Error('Send failed');
    
    // Refresh sessions to ensure we have the real db state
    if (isNewSession) {
      setTimeout(fetchSessions, 500);
    }
  } catch (err) {
    hideTyping();
    showToast('Backend not reachable', 'error');
  } finally {
    sendLock = false;
    btnSend.disabled = false;
    chatInput.focus();
  }
}

async function pollResponses() {
  if (!isPolling) return;
  try {
    const res = await fetch(`${API_URL}/chat/responses/${currentSessionId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.responses?.length) {
        hideTyping();
        data.responses.forEach(r => {
          const responseText = r.response || r.text || JSON.stringify(r);
          appendMessage(responseText, 'agent');
        });
      }
    }
  } catch (e) { /* ignore network glitches */ }
  if (isPolling) setTimeout(pollResponses, 2000);
}

// ── Sidebar Management ────────────────────────────────────────

function renderSessions() {
  if (!sessionsList) return;
  sessionsList.innerHTML = '';

  if (activeSessions.length === 0) {
    sessionsList.innerHTML = '<div style="color:#64748b;font-size:12px;padding:12px 16px;">No past sessions</div>';
    return;
  }

  activeSessions.forEach(s => {
    const el = document.createElement('div');
    el.className = `session-item ${s.id === currentSessionId ? 'active' : ''}`;
    el.innerHTML = `
      <svg class="session-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
      <span class="session-title">${escapeHtml(s.title || 'New Chat')}</span>
    `;
    el.addEventListener('click', () => switchSession(s.id));
    sessionsList.appendChild(el);
  });
}

function switchSession(id) {
  if (currentSessionId === id && chatHistory && chatHistory.children.length > 0) return; // Already on this session
  currentSessionId = id;
  localStorage.setItem(ACTIVE_SESSION_KEY, id);
  
  const sess = activeSessions.find(s => s.id === id);
  updateTopbar(sess ? sess.title : 'New Chat');
  renderSessions(); // Updates active class
  
  loadHistory(id);
}

function createNewSession() {
  const newId = crypto.randomUUID();
  switchSession(newId);
  chatInput.focus();
}

// ── Event Listeners ───────────────────────────────────────────
if ($('chat-form')) {
  $('chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (text) { sendMessage(text); chatInput.value = ''; }
  });
}

if ($('btn-new-chat')) {
  $('btn-new-chat').addEventListener('click', () => {
    createNewSession();
  });
}

if ($('btn-logout')) {
  $('btn-logout').addEventListener('click', () => {
    isPolling = false;
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    window.location.href = '/';
  });
}

// ── Init ──────────────────────────────────────────────────────
function initChat() {
  if (!chatHistory) return;
  initProfile();

  const savedId = localStorage.getItem(ACTIVE_SESSION_KEY);
  if (savedId) {
    currentSessionId = savedId;
    switchSession(savedId);
  }

  fetchSessions();

  isPolling = true;
  pollResponses();
}

document.addEventListener('DOMContentLoaded', initChat);
