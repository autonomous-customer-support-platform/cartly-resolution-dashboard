# Cartly Support & Resolution Platform

![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-F7DF1E?style=flat&logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-Vanilla-1572B6?style=flat&logo=css3&logoColor=white)
![Vite](https://img.shields.io/badge/Bundler-Vite-646CFF?style=flat&logo=vite&logoColor=white)
![Playwright](https://img.shields.io/badge/Testing-Playwright-2EAD33?style=flat&logo=playwright&logoColor=white)

Welcome to the **Cartly Support & Resolution Platform**, a premium, state-of-the-art autonomous customer support and resolution platform designed for monitoring cluster metrics, handling customer support chats, and managing dead-letter queue (DLQ) messages, orders, shipments, and payments.

This application is built with a sleek, modern glassmorphism aesthetic using vanilla CSS and JavaScript, and powered by **Vite** for lightning-fast development and compilation.

---

## Features

- **System Overview Panel**: Real-time monitoring stats of orders, customers, DLQ size, and latency.
- **Customer Support Hub**: Interactive chat interface for user resolution.
- **Order & Payment Directories**: Dynamic tables with pagination, query searches, and status filtering.
- **Redesigned Record Details**: Clicking a row opens a beautifully structures Card Grid layout modal instead of raw, hard-to-read JSON blocks.
- **Robust E2E Test Suite**: Fully automated test workflows using Playwright.

---

## Setup Instructions

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed (v18 or higher is recommended) along with `npm`.

### Installation

1. Clone or navigate to the directory of the project:
   ```bash
   cd aurora-dashboard
   ```

2. Install the project dependencies:
   ```bash
   npm install
   ```

3. (Testing Only) Install Playwright browser binaries:
   ```bash
   npx playwright install --with-deps
   ```

---

## Running the Application

To launch the local development server:

```bash
npm run dev
```

This starts the dev server at [http://localhost:5174](http://localhost:5174) (or another port if 5174 is occupied). Open this URL in your web browser.

### Credentials

- **Admin Login**:
  - **Username**: `admin`
  - **Password**: `cartly-admin`

- **Customer Signup/Login**:
  - Sign up with any valid email and password to access the support chat console.

---

## E2E Testing

The project uses **Playwright** for End-to-End browser automation testing. The tests are structured to cover 30 unique paths divided into 3 key categories: Happy Paths, Average Paths, and Sad Paths.

### Test Categories

1. **Happy Paths (`tests/e2e/happy.spec.js`)**: Covers successful admin login, user registration, default system layout loaded, directory panel switches, search, filtering, refresh updates, and logging out.
2. **Average Paths (`tests/e2e/average.spec.js`)**: Simulates complete user sessions (navigating multiple dashboards, sending support chat messages, validating viewport responsiveness, checking password visibility toggle).
3. **Sad Paths (`tests/e2e/sad.spec.js`)**: Validates negative workflows including invalid admin credentials, unregistered email logins, validation errors for missing signup fields, empty state display handlers, unauthorized route redirects to the home page, and network failures.

### Running the Tests

To run the entire test suite in headless mode (automatically starts the Vite server in the background):

```bash
npx playwright test
```

### Running Tests in UI Mode

To run Playwright's interactive runner to inspect timelines, DOM snapshots, and step-through executions visually:

```bash
npx playwright test --ui
```

### Running a Specific Test File

To target only a specific test category spec:

```bash
npx playwright test tests/e2e/happy.spec.js
npx playwright test tests/e2e/average.spec.js
npx playwright test tests/e2e/sad.spec.js
```

---
