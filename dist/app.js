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
  const dots = [...slideshow.querySelectorAll('[data-slide-to]')];
  const status = slideshow.querySelector('[data-slide-status]');
  const toggle = slideshow.querySelector('[data-slide-toggle]');
  let currentSlide = 0;
  let autoplayEnabled = !reducedMotion;
  let autoplayTimer;

  const stopAutoplay = () => window.clearInterval(autoplayTimer);
  const startAutoplay = () => {
    stopAutoplay();
    if (!autoplayEnabled || document.hidden || slideshow.matches(':hover') || slideshow.contains(document.activeElement)) return;
    autoplayTimer = window.setInterval(() => showSlide(currentSlide + 1), 5000);
  };

  const updateToggle = () => {
    if (!toggle) return;
    toggle.textContent = autoplayEnabled ? 'Ⅱ' : '▶';
    toggle.setAttribute('aria-label', autoplayEnabled ? 'Pause automatic slideshow' : 'Start automatic slideshow');
  };

  const showSlide = (index) => {
    currentSlide = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      const active = slideIndex === currentSlide;
      slide.hidden = !active;
      slide.classList.toggle('is-active', active);
    });
    dots.forEach((dot, dotIndex) => {
      const active = dotIndex === currentSlide;
      dot.classList.toggle('is-active', active);
      if (active) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    if (status) status.textContent = `${String(currentSlide + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
  };

  slideshow.querySelector('[data-slide-prev]')?.addEventListener('click', () => showSlide(currentSlide - 1));
  slideshow.querySelector('[data-slide-next]')?.addEventListener('click', () => showSlide(currentSlide + 1));
  dots.forEach((dot) => dot.addEventListener('click', () => showSlide(Number(dot.dataset.slideTo))));
  toggle?.addEventListener('click', () => {
    autoplayEnabled = !autoplayEnabled;
    updateToggle();
    startAutoplay();
  });
  slideshow.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') showSlide(currentSlide - 1);
    if (event.key === 'ArrowRight') showSlide(currentSlide + 1);
  });

  let touchStartX = 0;
  slideshow.addEventListener('touchstart', (event) => { touchStartX = event.changedTouches[0].clientX; }, { passive: true });
  slideshow.addEventListener('touchend', (event) => {
    const distance = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(distance) < 45) return;
    showSlide(currentSlide + (distance < 0 ? 1 : -1));
  }, { passive: true });

  slideshow.addEventListener('mouseenter', stopAutoplay);
  slideshow.addEventListener('mouseleave', startAutoplay);
  slideshow.addEventListener('focusin', stopAutoplay);
  slideshow.addEventListener('focusout', () => window.setTimeout(startAutoplay, 0));
  document.addEventListener('visibilitychange', startAutoplay);
  updateToggle();
  startAutoplay();
}

document.getElementById('year').textContent = new Date().getFullYear();
