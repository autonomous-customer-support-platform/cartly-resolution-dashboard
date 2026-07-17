// signin.js — Sign-in page logic (new si- namespace)

const SESSION_KEY   = 'cartly_admin_session';
const USER_KEY      = 'cartly_user_session';

document.addEventListener('DOMContentLoaded', () => {
  const card  = document.querySelector('.si-card');
  const tabs  = document.querySelectorAll('.si-tab');
  const forms = document.querySelectorAll('.si-form');

  // ── Tab switching ─────────────────────────────────────────
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('si-tab-active'));
      tab.classList.add('si-tab-active');

      const targetId = tab.getAttribute('data-target');
      forms.forEach(f => {
        if (f.id === targetId) {
          f.classList.remove('hidden');
        } else {
          f.classList.add('hidden');
        }
      });

      // Clear all errors
      document.querySelectorAll('.si-error').forEach(e => e.classList.add('hidden'));
    });
  });

  // ── Admin password toggle ─────────────────────────────────
  const pwToggle = document.getElementById('toggle-admin-pw');
  if (pwToggle) {
    const pwInput = document.getElementById('admin-pass');
    pwToggle.addEventListener('click', () => {
      const isHidden = pwInput.type === 'password';
      pwInput.type = isHidden ? 'text' : 'password';
    });
  }

  // ── Helper: show spinner / hide text ─────────────────────
  function setLoading(btn, loading) {
    const txt = btn.querySelector('.btn-text');
    const spin = btn.querySelector('.spinner');
    if (loading) { txt?.classList.add('hidden'); spin?.classList.remove('hidden'); }
    else         { txt?.classList.remove('hidden'); spin?.classList.add('hidden'); }
    btn.disabled = loading;
  }

  // ── Helper: shake the card ────────────────────────────────
  function shakeCard() {
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
  }
  card.addEventListener('animationend', e => {
    if (e.animationName === 'si-shake') card.classList.remove('shake');
  });

  // ── Helper: toast notification ────────────────────────────
  function toast(msg) {
    const existing = document.querySelector('.si-toast');
    if (existing) existing.remove();
    const el = Object.assign(document.createElement('div'), {
      className: 'si-toast',
      textContent: msg,
    });
    Object.assign(el.style, {
      position: 'fixed', bottom: '24px', left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(14,14,26,0.95)',
      border: '1px solid rgba(129,140,248,0.3)',
      borderRadius: '12px', padding: '11px 20px',
      color: '#94a3b8', fontSize: '13px',
      fontFamily: 'Inter, sans-serif', zIndex: '9999',
      backdropFilter: 'blur(16px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      maxWidth: '380px', textAlign: 'center',
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  // ── Google Auth ────────────────────────────────────────
  function decodeJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }

  function handleGoogleResponse(response) {
    const payload = decodeJwt(response.credential);
    if (!payload) return toast('Failed to authenticate with Google');

    const userSession = {
      id: crypto.randomUUID(),
      name: payload.name || 'Google User',
      email: payload.email,
      avatar: payload.picture,
      created_at: new Date().toISOString()
    };
    
    localStorage.setItem(USER_KEY, JSON.stringify(userSession));
    window.location.href = '/chat.html';
  }

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  console.log("GOOGLE CLIENT ID RESOLVED AS:", clientId);

  function initGoogleAuth() {
    if (window.google?.accounts?.id) {
      if (clientId && clientId !== 'your-google-client-id.apps.googleusercontent.com') {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleResponse
        });
        
        const userBtn = document.getElementById('google-btn-user');
        if (userBtn) google.accounts.id.renderButton(userBtn, { theme: "outline", size: "large", width: 330 });
        
        const signupBtn = document.getElementById('google-btn-signup');
        if (signupBtn) google.accounts.id.renderButton(signupBtn, { theme: "outline", size: "large", text: "signup_with", width: 330 });
      } else {
        const mockBtn = () => {
          toast('Google Auth skipped: Please configure VITE_GOOGLE_CLIENT_ID in .env');
        };
        const fallbackStyle = 'width: 100%; border: 1px solid #475569; border-radius: 8px; padding: 10px; background: transparent; color: #fff; cursor: pointer; font-size: 14px;';
        
        const ub = document.getElementById('google-btn-user');
        if(ub) { ub.innerHTML = `<button type="button" style="${fallbackStyle}">Continue with Google</button>`; ub.onclick = mockBtn; }
        
        const sb = document.getElementById('google-btn-signup');
        if(sb) { sb.innerHTML = `<button type="button" style="${fallbackStyle}">Sign up with Google</button>`; sb.onclick = mockBtn; }
      }
    } else {
      setTimeout(initGoogleAuth, 100);
    }
  }
  
  initGoogleAuth();

  // ── Customer Login ────────────────────────────────────────
  const formCustomer = document.getElementById('form-customer');
  const errCustomer  = document.getElementById('ul-error');
  formCustomer?.addEventListener('submit', async e => {
    e.preventDefault();
    errCustomer.classList.add('hidden');
    const btn = formCustomer.querySelector('[type="submit"]');
    setLoading(btn, true);

    const email = document.getElementById('cust-email').value.trim();

    try {
      const res = await fetch('http://localhost:8000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
      });
      
      const data = await res.json();
      
      setLoading(btn, false);
      if (!res.ok) {
        throw new Error(data.detail || "Invalid login credentials.");
      }
      
      localStorage.setItem(USER_KEY, JSON.stringify({
        customer_id: data.customer_id,
        email: data.email,
        name: data.name
      }));
      window.location.href = '/chat.html';
    } catch (err) {
      setLoading(btn, false);
      errCustomer.textContent = err.message || err;
      errCustomer.classList.remove('hidden');
      shakeCard();
    }
  });

  // ── Sign Up ───────────────────────────────────────────────
  const formSignup = document.getElementById('form-signup');
  formSignup?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = formSignup.querySelector('[type="submit"]');
    setLoading(btn, true);

    const first = document.getElementById('su-first').value.trim();
    const last  = document.getElementById('su-last').value.trim();
    const email = document.getElementById('su-email').value.trim();
    const password = document.getElementById('su-password').value;

    let pwError = "";
    if (!password) {
      pwError = "Password cannot be empty";
    } else if (!/[a-z]/.test(password)) {
      pwError = "Password needs at least one lowercase character";
    } else if (!/[A-Z]/.test(password)) {
      pwError = "Password needs at least one uppercase character";
    } else if (!/\d/.test(password)) {
      pwError = "Password needs at least one numeric symbol";
    } else if (!/[\W_]/.test(password)) {
      pwError = "Password needs at least one special symbol";
    } else if (password.length < 8) {
      pwError = "Password needs to be at least 8 characters long";
    }

    if (pwError) {
      setLoading(btn, false);
      let errElement = document.getElementById('su-error');
      if (!errElement) {
          errElement = document.createElement('div');
          errElement.id = 'su-error';
          errElement.className = 'si-error';
          formSignup.insertBefore(errElement, btn);
      }
      errElement.textContent = pwError;
      errElement.classList.remove('hidden');
      shakeCard();
      return;
    }

    try {
      const res = await fetch('http://localhost:8000/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: first, last_name: last, email: email })
      });
      
      const data = await res.json();
      
      setLoading(btn, false);
      if (!res.ok) {
        throw new Error(data.detail || "Signup failed.");
      }
      
      localStorage.setItem(USER_KEY, JSON.stringify({
        customer_id: data.customer_id,
        email: data.email,
        name: data.name,
      }));
      window.location.href = '/chat.html';
    } catch (err) {
      setLoading(btn, false);
      
      // Inject error element if missing
      let errElement = document.getElementById('su-error');
      if (!errElement) {
          errElement = document.createElement('div');
          errElement.id = 'su-error';
          errElement.className = 'si-error';
          formSignup.insertBefore(errElement, btn);
      }
      errElement.textContent = err.message || err;
      errElement.classList.remove('hidden');
      shakeCard();
    }
  });

  // ── Admin Login ───────────────────────────────────────────
  const formAdmin = document.getElementById('form-admin');
  const errAdmin  = document.getElementById('admin-error');
  formAdmin?.addEventListener('submit', async e => {
    e.preventDefault();
    errAdmin.classList.add('hidden');
    const btn = formAdmin.querySelector('[type="submit"]');
    setLoading(btn, true);

    const user = document.getElementById('admin-user').value.trim();
    const pass = document.getElementById('admin-pass').value;

    await delay(800);
    setLoading(btn, false);

    if (user === 'admin' && pass === 'cartly-admin') {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        token: 'mock-jwt-token-admin',
        user: 'admin',
        role: 'super_admin',
      }));
      window.location.href = '/dashboard.html';
    } else {
      errAdmin.classList.remove('hidden');
      shakeCard();
    }
  });

  // ── Helpers ───────────────────────────────────────────────
  function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
  function safeParseJSON(s) {
    try { return JSON.parse(s); } catch { return null; }
  }
});
