// login.js

document.addEventListener('DOMContentLoaded', () => {
  // Tab Switching Logic
  const tabs = document.querySelectorAll('.login-tab');
  const forms = document.querySelectorAll('.login-form');
  const loginCard = document.querySelector('.login-card');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active from all tabs
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Hide all forms
      forms.forEach(f => {
        f.classList.remove('active-form');
        setTimeout(() => f.classList.add('hidden'), 200); // fade out time
      });

      // Show target form
      const targetId = tab.getAttribute('data-target');
      const targetForm = document.getElementById(targetId);
      
      setTimeout(() => {
        targetForm.classList.remove('hidden');
        // trigger reflow
        void targetForm.offsetWidth;
        targetForm.classList.add('active-form');
      }, 200);
      
      // Clear errors on tab switch
      document.querySelectorAll('.login-error').forEach(err => err.classList.add('hidden'));
    });
  });

  // Admin Toggle Password Visibility
  const toggleBtn = document.querySelector('.toggle-pw');
  if (toggleBtn) {
    const pwInput = document.getElementById('admin-pass');
    toggleBtn.addEventListener('click', () => {
      const type = pwInput.getAttribute('type') === 'password' ? 'text' : 'password';
      pwInput.setAttribute('type', type);
      toggleBtn.classList.toggle('visible');
    });
  }

  // Handle Admin Login
  const formAdmin = document.getElementById('form-admin');
  const errAdmin = document.getElementById('admin-error');
  if (formAdmin) {
    formAdmin.addEventListener('submit', (e) => {
      e.preventDefault();
      errAdmin.classList.add('hidden');
      const btn = formAdmin.querySelector('button[type="submit"]');
      const text = btn.querySelector('.btn-text');
      const spinner = btn.querySelector('.spinner');

      text.classList.add('hidden');
      spinner.classList.remove('hidden');

      const user = document.getElementById('admin-user').value;
      const pass = document.getElementById('admin-pass').value;

      setTimeout(() => {
        text.classList.remove('hidden');
        spinner.classList.add('hidden');

        if (user === 'admin' && pass === 'cartly-admin') {
          // Success admin
          localStorage.setItem('cartly_admin_session', JSON.stringify({
            token: 'mock-jwt-token-admin',
            user: 'admin',
            role: 'super_admin'
          }));
          window.location.href = '/dashboard.html';
        } else {
          // Fail
          errAdmin.classList.remove('hidden');
          loginCard.classList.remove('shake');
          void loginCard.offsetWidth; // trigger reflow
          loginCard.classList.add('shake');
        }
      }, 800);
    });
  }

  // Handle User Sign Up
  const formSignup = document.getElementById('form-signup');
  if (formSignup) {
    formSignup.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const btn = formSignup.querySelector('button[type="submit"]');
      const text = btn.querySelector('.btn-text');
      const spinner = btn.querySelector('.spinner');

      text.classList.add('hidden');
      spinner.classList.remove('hidden');

      const firstName = document.getElementById('su-first').value;
      const lastName = document.getElementById('su-last').value;
      const email = document.getElementById('su-email').value;

      fetch('http://localhost:8000/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, email: email })
      })
      .then(res => {
        if (!res.ok) return res.json().then(data => Promise.reject(data.detail));
        return res.json();
      })
      .then(data => {
        text.classList.remove('hidden');
        spinner.classList.add('hidden');
        
        // Save user session
        localStorage.setItem('cartly_user_session', JSON.stringify({
          customer_id: data.customer_id,
          email: data.email,
          name: data.name
        }));
        window.location.href = '/chat.html';
      })
      .catch(err => {
        text.classList.remove('hidden');
        spinner.classList.add('hidden');
        
        const errElement = document.getElementById('su-error') || document.createElement('div');
        if (!document.getElementById('su-error')) {
            errElement.id = 'su-error';
            errElement.className = 'login-error';
            formSignup.insertBefore(errElement, btn);
        }
        errElement.textContent = err || "An error occurred during signup.";
        errElement.classList.remove('hidden');
        
        loginCard.classList.remove('shake');
        void loginCard.offsetWidth; // trigger reflow
        loginCard.classList.add('shake');
      });
    });
  }

  // Handle User Login
  const formUserLogin = document.getElementById('form-user-login');
  const errUser = document.getElementById('ul-error');
  if (formUserLogin) {
    formUserLogin.addEventListener('submit', (e) => {
      e.preventDefault();
      errUser.classList.add('hidden');
      
      const btn = formUserLogin.querySelector('button[type="submit"]');
      const text = btn.querySelector('.btn-text');
      const spinner = btn.querySelector('.spinner');

      text.classList.add('hidden');
      spinner.classList.remove('hidden');

      const email = document.getElementById('ul-email').value;
      const password = document.getElementById('ul-password').value;

      fetch('http://localhost:8000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password })
      })
      .then(res => {
        if (!res.ok) return res.json().then(data => Promise.reject(data.detail));
        return res.json();
      })
      .then(data => {
        text.classList.remove('hidden');
        spinner.classList.add('hidden');
        
        // Save user session
        localStorage.setItem('cartly_user_session', JSON.stringify({
          customer_id: data.customer_id,
          email: data.email,
          name: data.name
        }));
        window.location.href = '/chat.html';
      })
      .catch(err => {
        text.classList.remove('hidden');
        spinner.classList.add('hidden');
        
        errUser.textContent = err || "Invalid login credentials.";
        errUser.classList.remove('hidden');
        
        loginCard.classList.remove('shake');
        void loginCard.offsetWidth; // trigger reflow
        loginCard.classList.add('shake');
      });
    });
  }

  // Remove shake class after animation
  loginCard.addEventListener('animationend', (e) => {
    if (e.animationName === 'shake') {
      loginCard.classList.remove('shake');
    }
  });

  // Google Sign-In Buttons (UI demo — OAuth not wired)
  const googleButtons = document.querySelectorAll('.btn-google');
  googleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Show a friendly toast — Google OAuth integration pending
      showSigninToast('Google Sign-In is coming soon! Use email credentials for now.');
    });
  });

  function showSigninToast(msg) {
    const existing = document.querySelector('.signin-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'signin-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(20, 20, 35, 0.95);
      border: 1px solid rgba(129, 140, 248, 0.35);
      border-radius: 12px;
      padding: 12px 20px;
      color: #94a3b8;
      font-size: 13px;
      font-family: 'Inter', sans-serif;
      z-index: 9999;
      backdrop-filter: blur(16px);
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      animation: card-in 0.3s cubic-bezier(0.16,1,0.3,1);
      max-width: 380px;
      text-align: center;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  // Redirect if already logged in (depending on hash or previous visit)
  // We won't auto-redirect here so the user can freely choose which flow to test.
});
