# Cartly Frontend Terminal Test Bench

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white) ![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-F7DF1E?style=flat&logo=javascript&logoColor=black) ![CSS3](https://img.shields.io/badge/CSS3-Vanilla-1572B6?style=flat&logo=css3&logoColor=white)


This directory contains the frontend user interface for the Cartly microservices architecture. It is designed as a **Test Bench** (not a customer-facing production app) to help developers easily interact with and debug the backend AI Agent orchestration system.

## 🚀 Overview

The frontend is built with **Vite** and **Vanilla JavaScript**. It uses a lightweight, terminal-styled aesthetic to allow developers to interact with the system via simulated chat sessions, monitor backend notifications in real time, and manually trigger background mock events.

## ✨ Features

- **Session Management**: Automatically fetches existing chat sessions from Cassandra/Redis via the `ingestion_service` or generates fresh session IDs for testing.
- **Terminal Chat Interface**: Chat with the backend autonomous agents. It persists chat history and polls for streaming agent responses. Includes 1-click example prompts.
- **Live Notifications Panel**: Continuously polls for backend notifications (e.g., proactive alerts from the `notification_service`) and displays them instantly.
- **Mock Triggers**: Advanced test forms allowing you to manually inject specific system events (like `PAYMENT_FAILED` or `SHIPMENT_DELAYED`) directly into the Redis streams. Supports custom UUID overrides for testing idempotency and DLQ logic.

## 🛠 Prerequisites

For the frontend to work correctly, the entire backend microservices suite must be running.

From the root of the repository, start all microservices in development mode (which auto-reloads and starts the `ingestion_service` on port `8000`):

```bash
uv run start_services.py --dev
```

## 🏃 Getting Started

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open the provided URL (usually `http://localhost:5173`) in your browser.

## 📁 File Structure

- `index.html`: The core HTML structure for the terminal UI, broken down into a Setup Screen and a Chat Screen.
- `src/style.css`: Contains the CSS variables and terminal-themed styles (dark mode, monospace fonts, neon green accents).
- `src/main.js`: The frontend logic, including API fetching, recursive polling (`isPolling`), and DOM manipulation.
