
const TRANSLATIONS = {
  en: {
    sessions: "SESSIONS",
    new_chat: "New Chat",
    no_sessions: "No past sessions",
    placeholder: "Type your message...",
    welcome: "Hi! I'm Cartly's autonomous support assistant. How can I help you today?"
  },
  es: {
    sessions: "SESIONES",
    new_chat: "Nuevo Chat",
    no_sessions: "No hay sesiones pasadas",
    placeholder: "Escribe tu mensaje...",
    welcome: "¡Hola! Soy el asistente de soporte autónomo de Cartly. ¿Cómo puedo ayudarte hoy?"
  },
  fr: {
    sessions: "SESSIONS",
    new_chat: "Nouveau Chat",
    no_sessions: "Aucune session passée",
    placeholder: "Tapez votre message...",
    welcome: "Salut ! Je suis l'assistant de support autonome de Cartly. Comment puis-je vous aider aujourd'hui ?"
  },
  de: {
    sessions: "SITZUNGEN",
    new_chat: "Neuer Chat",
    no_sessions: "Keine vergangenen Sitzungen",
    placeholder: "Nachricht eingeben...",
    welcome: "Hallo! Ich bin der autonome Support-Assistent von Cartly. Wie kann ich Ihnen heute helfen?"
  },
  ja: {
    sessions: "セッション",
    new_chat: "新しいチャット",
    no_sessions: "過去のセッションはありません",
    placeholder: "メッセージを入力...",
    welcome: "こんにちは！Cartlyの自律型サポートアシスタントです。本日はどのようなご用件でしょうか？"
  },
  zh: {
    sessions: "会话",
    new_chat: "新聊天",
    no_sessions: "没有过去的会话",
    placeholder: "输入您的消息...",
    welcome: "你好！我是 Cartly 的自动支持助手。今天我能为您做些什么？"
  },
  hi: {
    sessions: "सत्र",
    new_chat: "नई चैट",
    no_sessions: "कोई पिछला सत्र नहीं",
    placeholder: "अपना संदेश टाइप करें...",
    welcome: "नमस्ते! मैं कार्टली का स्वायत्त समर्थन सहायक हूँ। आज मैं आपकी कैसे मदद कर सकता हूँ?"
  }
};

function applyLanguage() {
  const lang = localStorage.getItem("language") || "en";
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  
  const sessionsTitle = document.querySelector(".chat-sidebar .sidebar-header h2");
  if (sessionsTitle) sessionsTitle.textContent = t.sessions;
  
  const chatInput = document.getElementById("chat-input");
  if (chatInput) chatInput.placeholder = t.placeholder;
  
  const emptySessions = document.querySelector(".chat-sessions div");
  if (emptySessions && emptySessions.textContent.includes("No past sessions")) {
    emptySessions.textContent = t.no_sessions;
  }
}

document.addEventListener("languageChanged", applyLanguage);

// chat.js
// CARTLY CUSTOMER CHAT — Database-Backed Sessions

const SESSION_KEY = "cartly_user_session";
const ACTIVE_SESSION_KEY = "cartly_active_session";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

// ── Auth Guard ────────────────────────────────────────────────
const sessionRaw = localStorage.getItem(SESSION_KEY);
if (!sessionRaw) window.location.href = "/";
const session = JSON.parse(sessionRaw);

// ── State ─────────────────────────────────────────────────────
let currentSessionId = null;
let isPolling = false;
let sendLock = false;
let activeSessions = [];

// ── DOM Refs ──────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const chatHistory = $("chat-history");
const chatInput = $("chat-input");
const btnSend = $("btn-send");
const sessionsList = $("sessions-list");

// ── Init Profile ──────────────────────────────────────────────
function initProfile() {
  const name = session.name || "User";
  $("user-name").textContent = name;
  $("user-email").textContent = session.email || "\u2014";
  $("user-avatar").textContent = name.charAt(0).toUpperCase();
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = "info") {
  const container = $("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  const colors = { info: "#38bdf8", success: "#34d399", error: "#f87171" };
  toast.style.borderLeftColor = colors[type] || colors.info;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Chat UI Helpers ───────────────────────────────────────────
function formatTime(ts) {
  return new Date(ts || Date.now()).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function appendMessage(text, sender, ts = null) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${sender}`;
  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  const rawText =
    typeof text === "object" ? JSON.stringify(text, null, 2) : text;

  if (
    sender === "agent" &&
    typeof marked !== "undefined" &&
    typeof DOMPurify !== "undefined"
  ) {
    bubble.innerHTML = DOMPurify.sanitize(marked.parse(rawText));
  } else {
    bubble.textContent = rawText;
  }
  const time = document.createElement("div");
  time.className = "message-time";
  time.textContent = formatTime(ts);
  wrapper.appendChild(bubble);
  wrapper.appendChild(time);
  chatHistory.appendChild(wrapper);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function showTyping() {
  const el = document.createElement("div");
  el.className = "message agent";
  el.id = "typing-indicator";
  el.innerHTML =
    '<div class="message-bubble typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
  chatHistory.appendChild(el);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function hideTyping() {
  const el = $("typing-indicator");
  if (el) el.remove();
}

function deriveSessionTitle(rawTitle, fallbackText = "") {
  const title = (rawTitle || "").toString().trim();
  if (title && title !== (TRANSLATIONS[localStorage.getItem("language") || "en"] || TRANSLATIONS.en).new_chat) return title;
  const fallback = (fallbackText || "").toString().trim();
  if (!fallback) return "Customer Support";
  return (
    fallback.split(/\s+/).slice(0, 6).join(" ") +
    (fallback.split(/\s+/).length > 6 ? "…" : "")
  );
}

function updateTopbar(title, fallbackText = "") {
  const topbar = document.querySelector(".chat-topbar h2");
  if (topbar) topbar.textContent = deriveSessionTitle(title, fallbackText);
}

// ── API Interaction ───────────────────────────────────────────

async function fetchSessions() {
  try {
    const res = await fetch(
      `${API_URL}/chat/sessions/${session.customer_id || session.email}`,
    );
    if (res.ok) {
      const data = await res.json();

      if (data.sessions) {
        data.sessions.forEach((ds) => {
          const existing = activeSessions.find((s) => s.id === ds.id);
          const candidateTitle =
            ds.title && ds.title !== (TRANSLATIONS[localStorage.getItem("language") || "en"] || TRANSLATIONS.en).new_chat
              ? ds.title
              : existing?.title || "";
          if (candidateTitle) {
            ds.title = candidateTitle;
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
          if (savedId && activeSessions.find((s) => s.id === savedId)) {
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
  chatHistory.innerHTML = "";
  try {
    const res = await fetch(`${API_URL}/chat/history/${id}`);
    if (res.ok) {
      const data = await res.json();
      const history = data.history || [];
      if (history.length === 0) {
        appendMessage(
          (TRANSLATIONS[localStorage.getItem("language") || "en"] || TRANSLATIONS.en).welcome,
          "agent",
        );
      } else {
        history.forEach((m) => appendMessage(m.text, m.sender, m.ts));
      }
    } else {
      appendMessage(
        (TRANSLATIONS[localStorage.getItem("language") || "en"] || TRANSLATIONS.en).welcome,
        "agent",
      );
    }
  } catch (err) {
    console.error("Failed to load history:", err);
    appendMessage(
      (TRANSLATIONS[localStorage.getItem("language") || "en"] || TRANSLATIONS.en).welcome,
      "agent",
    );
  }
}

async function sendMessage(text) {
  if (!text || sendLock) return;
  sendLock = true;
  btnSend.disabled = true;

  // We immediately add it to the UI
  appendMessage(text, "user");
  showTyping();

  // If this is a brand new session, the API will create it. We can optimistic update the title.
  const isNewSession = !activeSessions.find((s) => s.id === currentSessionId);
  if (isNewSession) {
    const words = text.trim().split(/\s+/);
    const title =
      words.slice(0, 6).join(" ") + (words.length > 6 ? "\u2026" : "");
    activeSessions.unshift({ id: currentSessionId, title: title });
    renderSessions();
    updateTopbar(title, text);
  }

  try {
    let finalQuery = text;
    const lang = localStorage.getItem("language");
    if (lang && lang !== "en") {
      const langMap = {
        es: "Spanish", fr: "French", de: "German", ja: "Japanese", zh: "Chinese",
        hi: "Hindi", bn: "Bengali", te: "Telugu", mr: "Marathi", ta: "Tamil", it: "Italian"
      };
      if (langMap[lang]) {
        finalQuery = text + `\n\n[System Instruction: Please respond in ${langMap[lang]}]`;
      }
    }

    const res = await fetch(`${API_URL}/chat/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: currentSessionId,
        customer_id: session.customer_id || session.email,
        query: finalQuery,
      }),
    });
    if (!res.ok) throw new Error("Send failed");

    // Refresh sessions to ensure we have the real db state
    if (isNewSession) {
      setTimeout(fetchSessions, 500);
    }
  } catch (err) {
    hideTyping();
    showToast("Backend not reachable", "error");
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
        data.responses.forEach((r) => {
          const responseText = r.response || r.text || JSON.stringify(r);
          appendMessage(responseText, "agent");
        });
      }
    }
  } catch (e) {
    /* ignore network glitches */
  }
  if (isPolling) setTimeout(pollResponses, 2000);
}

// ── Sidebar Management ────────────────────────────────────────

function renderSessions() {
  if (!sessionsList) return;
  sessionsList.innerHTML = "";

  if (activeSessions.length === 0) {
    sessionsList.innerHTML =
      '<div style="color:#64748b;font-size:12px;padding:12px 16px;">No past sessions</div>';
    return;
  }

  activeSessions.forEach((s) => {
    const el = document.createElement("div");
    el.className = `session-item ${s.id === currentSessionId ? "active" : ""}`;
    el.innerHTML = `
      <svg class="session-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
      <span class="session-title">${escapeHtml(s.title || (TRANSLATIONS[localStorage.getItem("language") || "en"] || TRANSLATIONS.en).new_chat)}</span>
    `;
    el.addEventListener("click", () => switchSession(s.id));
    sessionsList.appendChild(el);
  });
}

function switchSession(id) {
  if (currentSessionId === id && chatHistory && chatHistory.children.length > 0)
    return; // Already on this session
  currentSessionId = id;
  localStorage.setItem(ACTIVE_SESSION_KEY, id);

  const sess = activeSessions.find((s) => s.id === id);
  updateTopbar(sess ? sess.title : (TRANSLATIONS[localStorage.getItem("language") || "en"] || TRANSLATIONS.en).new_chat);
  renderSessions(); // Updates active class

  loadHistory(id);
}

function createNewSession() {
  const newId = crypto.randomUUID();
  switchSession(newId);
  chatInput.focus();
}

// ── Event Listeners ───────────────────────────────────────────
if ($("chat-form")) {
  $("chat-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (text) {
      sendMessage(text);
      chatInput.value = "";
    }
  });
}

if ($("btn-new-chat")) {
  $("btn-new-chat").addEventListener("click", () => {
    createNewSession();
  });
}

if ($("btn-logout")) {
  $("btn-logout").addEventListener("click", () => {
    isPolling = false;
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    window.location.href = "/";
  });
}

// ── Init ──────────────────────────────────────────────
function initChat() {
  if (!chatHistory) return;
  initProfile();

  // Do NOT pre-load a session from localStorage here.
  // fetchSessions() validates the saved ACTIVE_SESSION_KEY against
  // the current user's actual sessions before restoring it.
  // Loading it eagerly would show another user's history if the
  // same browser was previously used by a different account.
  fetchSessions();
  applyLanguage();

  isPolling = true;
  pollResponses();
}

document.addEventListener("DOMContentLoaded", initChat);
