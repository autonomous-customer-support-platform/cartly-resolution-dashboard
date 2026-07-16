// chat.js
// CARTLY CUSTOMER CHAT

const SESSION_KEY = 'cartly_user_session';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// ── Auth Guard ────────────────────────────────────────────────
const sessionRaw = localStorage.getItem(SESSION_KEY);
if (!sessionRaw) window.location.href = '/';
const session = JSON.parse(sessionRaw);

// ── State ─────────────────────────────────────────────────────
let currentSessionId = crypto.randomUUID();
let isPolling = false;
let sendLock = false;

// ── DOM Refs ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const chatHistory = $('chat-history');
const chatInput = $('chat-input');
const btnSend = $('btn-send');

// ── Init Profile ──────────────────────────────────────────────
function initProfile() {
  const name = session.name || 'User';
  $('user-name').textContent = name;
  $('user-email').textContent = session.email || '—';
  $('user-avatar').textContent = name.charAt(0).toUpperCase();
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
  
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Chat UI Helpers ───────────────────────────────────────────
function formatTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function appendMessage(text, sender) {
  const wrapper = document.createElement('div');
  wrapper.className = `message ${sender}`;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.textContent = typeof text === 'object' ? JSON.stringify(text, null, 2) : text;

  const time = document.createElement('div');
  time.className = 'message-time';
  time.textContent = formatTime();

  wrapper.appendChild(bubble);
  wrapper.appendChild(time);
  chatHistory.appendChild(wrapper);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function showTyping() {
  const el = document.createElement('div');
  el.className = 'message agent';
  el.id = 'typing-indicator';
  el.innerHTML = `
    <div class="message-bubble typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>`;
  chatHistory.appendChild(el);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function hideTyping() {
  const el = $('typing-indicator');
  if (el) el.remove();
}

// ── API Interaction ───────────────────────────────────────────
async function sendMessage(text) {
  if (!text || sendLock) return;
  sendLock = true;
  btnSend.disabled = true;

  appendMessage(text, 'user');
  showTyping();

  try {
    const res = await fetch(`${API_URL}/chat/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: currentSessionId,
        customer_id: session.customer_id,
        query: text,
      }),
    });
    if (!res.ok) throw new Error('Send failed');
  } catch (err) {
    hideTyping();
    showToast('Failed to send message', 'error');
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
        data.responses.forEach(r => appendMessage(r.response, 'agent'));
      }
    }
  } catch (e) {
    // ignore network glitches
  }
  if (isPolling) setTimeout(pollResponses, 2000);
}

// ── Event Listeners ───────────────────────────────────────────
$('chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (text) {
    sendMessage(text);
    chatInput.value = '';
  }
});

$('btn-logout').addEventListener('click', () => {
  isPolling = false;
  localStorage.removeItem(SESSION_KEY);
  window.location.href = '/';
});

// ── Init ──────────────────────────────────────────────────────
function initChat() {
  initProfile();
  
  // Welcome message
  appendMessage("Hi! I'm Cartly's autonomous support assistant. How can I help you today?", 'agent');
  
  isPolling = true;
  pollResponses();
}

document.addEventListener('DOMContentLoaded', initChat);
