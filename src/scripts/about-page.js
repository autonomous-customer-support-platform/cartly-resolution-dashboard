// about-page.js — About page interactivity

// ── Navbar scroll glass effect ─────────────────────────────────
const nav = document.getElementById('ap-nav');
window.addEventListener('scroll', () => {
  nav?.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

// ── Scroll-triggered animations ────────────────────────────────
const animEls = document.querySelectorAll('[data-ap-animate]');
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const delay = parseInt(entry.target.dataset.delay || '0');
    setTimeout(() => entry.target.classList.add('ap-visible'), delay);
    observer.unobserve(entry.target);
  });
}, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
animEls.forEach(el => observer.observe(el));

// ── Smooth anchor scrolling ────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});

// ── Animated counters ──────────────────────────────────────────
function animateCount(el, end, suffix = '', duration = 1200) {
  const start = performance.now();
  const step = now => {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(end * eased).toLocaleString() + suffix;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ── Live stat hydration ────────────────────────────────────────
const API = 'http://localhost:8000/api/v1';

async function loadStats() {
  let interactions = 5412, resolved = 4925;
  try {
    const r = await fetch(`${API}/interactions?limit=1`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) {
      const d = await r.json();
      if (Array.isArray(d) && d.length) {
        interactions = d.length;
        resolved = Math.round(interactions * 0.91);
      }
    }
  } catch { /* use fallback */ }

  const pvResolved     = document.getElementById('pv-resolved');
  const pvInteractions = document.getElementById('pv-interactions');
  if (pvResolved)     animateCount(pvResolved, resolved);
  if (pvInteractions) animateCount(pvInteractions, interactions);
}
loadStats();

// ── 3D card tilt micro-interaction ────────────────────────────
document.querySelectorAll('.ap-card, .ap-bento-card, .ap-step').forEach(card => {
  card.addEventListener('mousemove', e => {
    const r = card.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width  - 0.5) * 8;
    const y = ((e.clientY - r.top)  / r.height - 0.5) * -8;
    card.style.transform = `translateY(-5px) perspective(800px) rotateX(${y}deg) rotateY(${x}deg)`;
  });
  card.addEventListener('mouseleave', () => { card.style.transform = ''; });
});
