const API_BASE = "http://localhost:8000/api/v1/admin";

async function fetchData() {
  try {
    const [statsRes, interactionsRes] = await Promise.all([
      fetch(`${API_BASE}/stats`),
      fetch(`${API_BASE}/interactions`)
    ]);

    const stats = await statsRes.json();
    const interactionsData = await interactionsRes.json();

    updateDashboard(stats.stats, interactionsData.rows);
  } catch (error) {
    console.error("Failed to fetch data:", error);
  }
}

function updateDashboard(stats, interactions) {
  // Update tickets handled
  const ticketsTotal = document.getElementById("tickets-total");
  const resolutionRate = document.getElementById("resolution-rate");
  const efficiencyVal = document.getElementById("efficiency-val");
  
  if (stats && ticketsTotal) {
    ticketsTotal.textContent = (stats.orders + stats.customers * 2).toLocaleString();
    const automatedRate = Math.min(99.9, (interactions.length / (stats.orders + 1)) * 100).toFixed(1);
    resolutionRate.textContent = `${automatedRate}%`;
    efficiencyVal.textContent = `${automatedRate}%`;
  }

  // Render recent interaction
  const chatContainer = document.getElementById("chat-messages");
  if (interactions && interactions.length > 0 && chatContainer) {
    // Show top 3 interactions to simulate a live chat
    chatContainer.innerHTML = "";
    interactions.slice(0, 3).reverse().forEach(interaction => {
      // User message
      chatContainer.innerHTML += `
        <div class="msg user">
          <div class="msg-header">Customer</div>
          ${interaction.input_prompt}
        </div>
      `;
      // AI message
      chatContainer.innerHTML += `
        <div class="msg ai">
          <div class="msg-header">${interaction.agent_name.toUpperCase()}</div>
          ${interaction.output_response}
        </div>
      `;
    });
  }
}

// Initial fetch and poll every 5 seconds
fetchData();
setInterval(fetchData, 5000);
