const API_URL = "http://localhost:8000/api/v1";

const setupScreen = document.getElementById("setup-screen");
const chatScreen = document.getElementById("chat-screen");

const customerIdInput = document.getElementById("customer-id");
const btnFetchSessions = document.getElementById("btn-fetch-sessions");
const sessionSelect = document.getElementById("session-select");
const btnStartChat = document.getElementById("btn-start-chat");

const displaySession = document.getElementById("display-session");
const btnBack = document.getElementById("btn-back");
const chatHistory = document.getElementById("chat-history");
const chatInput = document.getElementById("chat-input");
const btnSend = document.getElementById("btn-send");
const exampleBtns = document.querySelectorAll(".example-btn");

const notificationsList = document.getElementById("notifications-list");
const btnTriggerShipping = document.getElementById("btn-trigger-shipping");
const btnTriggerPayment = document.getElementById("btn-trigger-payment");

let currentSessionId = null;
let currentCustomerId = null;
let pollingIntervals = [];

// Setup Screen Logic
btnFetchSessions.addEventListener("click", async () => {
  const customerId = customerIdInput.value.trim();
  if (!customerId) return alert("Please enter a Customer ID");
  
  try {
    const res = await fetch(`${API_URL}/chat/sessions/${customerId}`);
    const data = await res.json();
    
    // Clear existing
    sessionSelect.innerHTML = '<option value="">-- Start New Session --</option>';
    if (data.sessions && data.sessions.length > 0) {
      data.sessions.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = s.id;
        sessionSelect.appendChild(opt);
      });
    }
  } catch (err) {
    console.error(err);
    alert("Failed to fetch sessions. Make sure ingestion_service is running on port 8000.");
  }
});

btnStartChat.addEventListener("click", async () => {
  const customerId = customerIdInput.value.trim();
  if (!customerId) return alert("Please enter a Customer ID");
  
  let sessionId = sessionSelect.value;
  if (!sessionId) {
    // Generate new
    sessionId = crypto.randomUUID();
  }
  
  currentCustomerId = customerId;
  currentSessionId = sessionId;
  
  displaySession.textContent = sessionId;
  chatHistory.innerHTML = "";
  notificationsList.innerHTML = "";
  
  setupScreen.classList.remove("active");
  chatScreen.classList.add("active");
  
  // Load History
  try {
    const res = await fetch(`${API_URL}/chat/history/${currentSessionId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.history) {
        data.history.forEach(h => appendMessage(h.text, h.sender));
      }
    }
  } catch (err) {
    console.error("Failed to load history", err);
  }

  startPolling();
});

btnBack.addEventListener("click", () => {
  stopPolling();
  chatScreen.classList.remove("active");
  setupScreen.classList.add("active");
});

// Chat Logic
function appendMessage(text, sender) {
  const div = document.createElement("div");
  div.className = `message ${sender}`;
  div.textContent = typeof text === "object" ? JSON.stringify(text, null, 2) : text;
  chatHistory.appendChild(div);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

async function sendMessage(text) {
  if (!text) return;
  appendMessage(text, "user");
  
  try {
    const res = await fetch(`${API_URL}/chat/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: currentSessionId,
        customer_id: currentCustomerId,
        query: text
      })
    });
    if (!res.ok) throw new Error("Failed to send");
  } catch (err) {
    console.error(err);
    appendMessage("System: Error sending message", "agent");
  }
}

btnSend.addEventListener("click", () => {
  const text = chatInput.value.trim();
  if (text) {
    sendMessage(text);
    chatInput.value = "";
  }
});

chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const text = chatInput.value.trim();
    if (text) {
      sendMessage(text);
      chatInput.value = "";
    }
  }
});

exampleBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const text = btn.getAttribute("data-text");
    chatInput.value = text;
  });
});

// Notification Mock Logic
const paymentEventType = document.getElementById("payment-event-type");
const paymentMsgId = document.getElementById("payment-msg-id");
const shippingEventType = document.getElementById("shipping-event-type");
const shippingMsgId = document.getElementById("shipping-msg-id");

btnTriggerShipping.addEventListener("click", async () => {
  try {
    await fetch(`${API_URL}/test/shipment-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        customer_id: currentCustomerId,
        event_type: shippingEventType.value,
        message_id: shippingMsgId.value.trim() || undefined
      })
    });
  } catch (err) { console.error(err); }
});

btnTriggerPayment.addEventListener("click", async () => {
  try {
    await fetch(`${API_URL}/test/payment-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        customer_id: currentCustomerId,
        event_type: paymentEventType.value,
        message_id: paymentMsgId.value.trim() || undefined
      })
    });
  } catch (err) { console.error(err); }
});

let isPolling = false;

async function pollResponses() {
  if (!isPolling) return;
  try {
    const res = await fetch(`${API_URL}/chat/responses/${currentSessionId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.responses) {
        data.responses.forEach(r => {
          appendMessage(r.response, "agent");
        });
      }
    }
  } catch (err) { }
  
  if (isPolling) {
    setTimeout(pollResponses, 2000);
  }
}

async function pollNotifications() {
  if (!isPolling) return;
  try {
    const res = await fetch(`${API_URL}/chat/notifications/${currentCustomerId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.notifications) {
        data.notifications.forEach(n => {
          const div = document.createElement("div");
          div.className = `notification ${n.type || ""}`;
          div.textContent = n.message || JSON.stringify(n);
          notificationsList.prepend(div);
        });
      }
    }
  } catch (err) { }
  
  if (isPolling) {
    setTimeout(pollNotifications, 2500);
  }
}

function startPolling() {
  if (isPolling) return; // Prevent duplicate polling loops
  isPolling = true;
  pollResponses();
  pollNotifications();
}

function stopPolling() {
  isPolling = false;
}
