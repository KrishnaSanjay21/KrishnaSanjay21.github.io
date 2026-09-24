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

const flightMap = document.querySelector('[data-flight-map]');
if (flightMap) {
  const stage = flightMap.querySelector('[data-flight-stage]');
  const plane = flightMap.querySelector('[data-flight-plane]');
  const stops = [...flightMap.querySelectorAll('[data-flight-stop]')];
  const guidePath = flightMap.querySelector('[data-flight-guide]');
  const livePath = flightMap.querySelector('[data-flight-live]');
  const cityLabel = flightMap.querySelector('[data-flight-city]');
  const dateLabel = flightMap.querySelector('[data-flight-date]');
  const venueLabel = flightMap.querySelector('[data-flight-venue]');
  const stateLabel = flightMap.querySelector('[data-flight-state]');
  const points = stops.map((stop) => ({ x: Number(stop.dataset.x), y: Number(stop.dataset.y) }));
  stops.forEach((stop, index) => {
    stop.style.setProperty('--x', points[index].x);
    stop.style.setProperty('--y', points[index].y);
  });
  let currentStop = 0;
  let flightTimer;
  let isFlying = false;
  let paused = false;

  const mapPoint = (point) => ({ x: point.x * 10, y: point.y * 5.2 });
  const pathThrough = (lastIndex) => {
    const first = mapPoint(points[0]);
    let path = `M ${first.x} ${first.y}`;
    for (let index = 1; index <= lastIndex; index += 1) {
      const from = mapPoint(points[index - 1]);
      const to = mapPoint(points[index]);
      const curve = 34 + Math.abs(to.x - from.x) * 0.12;
      path += ` Q ${(from.x + to.x) / 2} ${Math.min(from.y, to.y) - curve} ${to.x} ${to.y}`;
    }
    return path;
  };

  const placePlane = (index) => {
    plane.style.left = `${points[index].x}%`;
    plane.style.top = `${points[index].y}%`;
  };

  const showStop = (index, inFlight = false) => {
    const stop = stops[index];
    if (cityLabel) cityLabel.textContent = inFlight ? 'Somewhere new…' : `${stop.dataset.city}.`;
    if (dateLabel) dateLabel.textContent = inFlight ? 'Destination incoming' : stop.dataset.date;
    if (venueLabel) venueLabel.textContent = inFlight ? 'The city reveals when the plane lands.' : stop.dataset.venue;
    if (stateLabel) stateLabel.textContent = inFlight ? 'In flight' : index === 0 ? 'First destination' : `Arrived in ${stop.dataset.city}`;
    stops.forEach((item, itemIndex) => {
      item.classList.toggle('is-active', !inFlight && itemIndex === index);
      item.classList.toggle('is-complete', itemIndex < index);
      if (!inFlight && itemIndex === index) item.classList.add('is-revealed');
      item.setAttribute('aria-hidden', String(!item.classList.contains('is-revealed')));
    });
  };

  const scheduleFlight = () => {
    window.clearTimeout(flightTimer);
    if (reducedMotion || paused || document.hidden || stops.length < 2) return;
    flightTimer = window.setTimeout(() => flyTo((currentStop + 1) % stops.length), 1250);
  };

  const flyTo = async (nextStop) => {
    if (isFlying || nextStop === currentStop) return;
    isFlying = true;
    window.clearTimeout(flightTimer);
    stage.classList.add('is-flying');
    showStop(nextStop, true);
    const from = { x: stage.clientWidth * points[currentStop].x / 100, y: stage.clientHeight * points[currentStop].y / 100 };
    const to = { x: stage.clientWidth * points[nextStop].x / 100, y: stage.clientHeight * points[nextStop].y / 100 };
    const control = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - Math.max(42, Math.abs(to.x - from.x) * .25) };
    const frames = [];
    for (let step = 0; step <= 24; step += 1) {
      const progress = step / 24;
      const inverse = 1 - progress;
      const x = inverse * inverse * from.x + 2 * inverse * progress * control.x + progress * progress * to.x;
      const y = inverse * inverse * from.y + 2 * inverse * progress * control.y + progress * progress * to.y;
      const nextProgress = Math.min(1, progress + .03);
      const nextInverse = 1 - nextProgress;
      const nextX = nextInverse * nextInverse * from.x + 2 * nextInverse * nextProgress * control.x + nextProgress * nextProgress * to.x;
      const nextY = nextInverse * nextInverse * from.y + 2 * nextInverse * nextProgress * control.y + nextProgress * nextProgress * to.y;
      const angle = Math.atan2(nextY - y, nextX - x) * 180 / Math.PI;
      frames.push({ left: `${x}px`, top: `${y}px`, transform: `translate(-50%,-50%) rotate(${angle + 8}deg)` });
    }
    const animation = plane.animate(frames, { duration: reducedMotion ? 1 : 1800, easing: 'ease-in-out', fill: 'forwards' });
    try { await animation.finished; } catch {}
    currentStop = nextStop;
    animation.cancel();
    placePlane(currentStop);
    livePath.setAttribute('d', pathThrough(currentStop));
    showStop(currentStop);
    stage.classList.remove('is-flying');
    isFlying = false;
    scheduleFlight();
  };

  guidePath.setAttribute('d', pathThrough(points.length - 1));
  livePath.setAttribute('d', pathThrough(0));
  placePlane(0);
  showStop(0);
  if (reducedMotion) stops.forEach((stop) => { stop.classList.add('is-revealed'); stop.setAttribute('aria-hidden', 'false'); });
  flightMap.addEventListener('mouseenter', () => { paused = true; window.clearTimeout(flightTimer); });
  flightMap.addEventListener('mouseleave', () => { paused = false; scheduleFlight(); });
  flightMap.addEventListener('focusin', () => { paused = true; window.clearTimeout(flightTimer); });
  flightMap.addEventListener('focusout', (event) => {
    if (!flightMap.contains(event.relatedTarget)) { paused = false; scheduleFlight(); }
  });
  window.addEventListener('resize', () => { if (!isFlying) placePlane(currentStop); }, { passive: true });
  document.addEventListener('visibilitychange', scheduleFlight);
  scheduleFlight();
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
