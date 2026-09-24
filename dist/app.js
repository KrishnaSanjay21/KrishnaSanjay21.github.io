const header = document.querySelector('[data-header]');
const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('.main-nav');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const updateHeader = () => header?.classList.toggle('scrolled', window.scrollY > 24);
updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!open));
  nav?.classList.toggle('open', !open);
});

nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  menuButton?.setAttribute('aria-expanded', 'false');
  nav.classList.remove('open');
}));

const revealItems = document.querySelectorAll('[data-reveal]');
if (reducedMotion || !('IntersectionObserver' in window)) {
  revealItems.forEach((item) => item.classList.add('is-visible'));
} else {
  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      currentObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -30px' });
  revealItems.forEach((item) => observer.observe(item));
}

const tilt = document.querySelector('[data-tilt]');
if (tilt && !reducedMotion && window.matchMedia('(pointer: fine)').matches) {
  tilt.addEventListener('pointermove', (event) => {
    const rect = tilt.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    tilt.style.transform = `perspective(900px) rotateY(${x * 5}deg) rotateX(${y * -5}deg)`;
  });
  tilt.addEventListener('pointerleave', () => { tilt.style.transform = ''; });
}

const slideshow = document.querySelector('[data-slideshow]');
if (slideshow) {
  const slides = [...slideshow.querySelectorAll('[data-slide]')];
  let currentSlide = 0;
  let autoplayTimer;

  const showSlide = (index) => {
    currentSlide = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      const active = slideIndex === currentSlide;
      slide.hidden = !active;
      slide.classList.toggle('is-active', active);
    });
  };

  const startAutoplay = () => {
    window.clearInterval(autoplayTimer);
    if (document.hidden || slides.length < 2) return;
    autoplayTimer = window.setInterval(() => showSlide(currentSlide + 1), 4500);
  };

  document.addEventListener('visibilitychange', startAutoplay);
  startAutoplay();
}

const stickyTickets = document.querySelector('.sticky-tickets');
const youtubeSection = document.querySelector('.youtube-section');
const updateStickyTickets = () => {
  const videoRect = youtubeSection?.getBoundingClientRect();
  const videoInView = videoRect && videoRect.top < window.innerHeight - 96 && videoRect.bottom > 96;
  stickyTickets?.classList.toggle('is-visible', window.scrollY > Math.min(520, window.innerHeight * 0.62) && !videoInView);
};
updateStickyTickets();
window.addEventListener('scroll', updateStickyTickets, { passive: true });

const alertForm = document.querySelector('[data-alert-form]');
alertForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const email = new FormData(alertForm).get('email')?.toString().trim();
  if (!email) return;
  const subject = encodeURIComponent('Join Call Me Manny tour alerts');
  const body = encodeURIComponent(`Please add ${email} to Call Me Manny tour alerts.\n\nThe city I want Manny to visit is: `);
  const status = alertForm.querySelector('[data-form-status]');
  if (status) status.textContent = 'Your email app is opening—add your city, then send.';
  window.location.href = `mailto:callmannymgmt@gmail.com?subject=${subject}&body=${body}`;
});

document.getElementById('year').textContent = new Date().getFullYear();
