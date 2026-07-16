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

      setTimeout(() => {
        text.classList.remove('hidden');
        spinner.classList.add('hidden');

        // Generate a new customer ID (UUID)
        const customerId = crypto.randomUUID();
        
        // Save user session
        localStorage.setItem('cartly_user_session', JSON.stringify({
          customer_id: customerId,
          email: email,
          name: `${firstName} ${lastName}`
        }));

        // Normally we would save this to the backend here, but we'll mock it for now
        // redirect to chat
        window.location.href = '/chat.html';
      }, 800);
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

      setTimeout(() => {
        text.classList.remove('hidden');
        spinner.classList.add('hidden');

        // Check if there's a stored user session that matches this email
        const stored = localStorage.getItem('cartly_user_session');
        if (stored) {
          const userData = JSON.parse(stored);
          if (userData.email === email) {
            window.location.href = '/chat.html';
            return;
          }
        }

        // If not found, show error
        errUser.classList.remove('hidden');
        loginCard.classList.remove('shake');
        void loginCard.offsetWidth; // trigger reflow
        loginCard.classList.add('shake');
      }, 800);
    });
  }

  // Remove shake class after animation
  loginCard.addEventListener('animationend', (e) => {
    if (e.animationName === 'shake') {
      loginCard.classList.remove('shake');
    }
  });

  // Redirect if already logged in (depending on hash or previous visit)
  // We won't auto-redirect here so the user can freely choose which flow to test.
});
