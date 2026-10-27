/* ==========================================================
   Memorii Events - main script
   - Mobile menu
   - Hero carousel (photos 3s, videos 5s, hover/tap holds a video to the end)
   - Reviews row (reads assets/data/reviews.json, shows every review)
   ========================================================== */
(function () {
  'use strict';

  // ---- Settings you may want to change ----
  const CONFIG = {
    photoMs: 3000,                 // how long each photo shows
    videoMs: 5000,                 // how long each video plays unless hovered or tapped
    googleReviewUrl: 'https://share.google/uXJxlVjsRoBqMtUKE', // Google Business Profile review link
                                   // When set, each review card shows a "Posted on Google" link.
  };

  const $ = (sel, root = document) => root.querySelector(sel);

  // ---- Mobile menu ----
  const toggle = $('.menu-toggle');
  const nav = $('#site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
  }

  // ---- Hero carousel ----
  function initCarousel(items) {
    const stage = $('.carousel-stage');
    const countEl = $('.carousel-count');
    const prevBtn = $('.carousel-btn.prev');
    const nextBtn = $('.carousel-btn.next');
    if (!stage || !items.length) return;

    let current = -1;
    let timer = null;

    const slides = items.map((item, i) => {
      const el = document.createElement('div');
      el.className = 'slide';
      el.setAttribute('aria-hidden', 'true');

      const isVideo = item.type === 'video';
      const media = document.createElement(isVideo ? 'video' : 'img');
      media.dataset.src = item.src;   // real file is loaded only when needed (lazy)

      if (isVideo) {
        // Videos are always muted and inline. They never play with sound.
        media.muted = true;
        media.defaultMuted = true;
        media.playsInline = true;
        media.setAttribute('muted', '');
        media.setAttribute('playsinline', '');
        media.setAttribute('aria-label', item.alt);
        media.preload = 'none';

        media.addEventListener('ended', () => { if (current === i) next(); });

        // Hovering (mouse) or tapping the video lets it play to the end.
        media.addEventListener('pointerenter', (e) => {
          if (e.pointerType === 'mouse' && current === i) hold();
        });
        let sx = 0, sy = 0;
        media.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
        media.addEventListener('pointerup', (e) => {
          const moved = Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10;
          if (current === i && !moved) hold();   // a tap, not a swipe
        });
      } else {
        media.alt = item.alt;
        media.decoding = 'async';
      }

      el.appendChild(media);
      stage.appendChild(el);
      return { el, media, isVideo };
    });

    function load(i) {
      const s = slides[((i % slides.length) + slides.length) % slides.length];
      if (!s.media.getAttribute('src')) {
        s.media.src = s.media.dataset.src;
        if (s.isVideo) s.media.preload = 'metadata';
      }
    }

    function clearTimer() {
      if (timer) { clearTimeout(timer); timer = null; }
    }

    // Stop the auto-advance timer. The video will advance when it ends.
    function hold() {
      clearTimer();
    }

    function show(i) {
      const n = slides.length;
      current = ((i % n) + n) % n;
      clearTimer();

      slides.forEach((s, k) => {
        const on = k === current;
        s.el.classList.toggle('is-active', on);
        s.el.setAttribute('aria-hidden', String(!on));
        if (!on && s.isVideo) s.media.pause();
      });

      const s = slides[current];
      load(current);
      load(current + 1);

      if (s.isVideo) {
        s.media.currentTime = 0;
        const p = s.media.play();
        if (p && p.catch) p.catch(() => {});
        timer = setTimeout(next, CONFIG.videoMs);
      } else {
        timer = setTimeout(next, CONFIG.photoMs);
      }

      if (countEl) countEl.textContent = `${current + 1} / ${n}`;
    }

    function next() { show(current + 1); }
    function prev() { show(current - 1); }

    if (nextBtn) nextBtn.addEventListener('click', next);
    if (prevBtn) prevBtn.addEventListener('click', prev);

    // Swipe on touch screens
    let x0 = null;
    stage.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.carousel-btn')) return;
      x0 = e.clientX;
    });
    stage.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
    });

    // Keyboard: focus the carousel, then use the left and right arrow keys
    stage.tabIndex = 0;
    stage.setAttribute('aria-label', 'Event photos and videos. Use the left and right arrow keys to browse.');
    stage.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    });

    show(0);
  }

  // ---- Reviews ----
  function formatDate(s) {
    const d = new Date(s + 'T00:00:00');
    return isNaN(d) ? s : d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function renderReviews(list) {
    const track = $('[data-reviews]');
    if (!track) return;
    track.innerHTML = '';

    // Every review in the file is shown. The "featured" field is ignored on purpose.
    list.forEach((r) => {
      const card = document.createElement('article');
      card.className = 'review-card';

      const n = Math.max(0, Math.min(5, Number(r.rating) || 0));
      const stars = document.createElement('div');
      stars.className = 'stars';
      stars.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
      stars.setAttribute('role', 'img');
      stars.setAttribute('aria-label', `${n} out of 5 stars`);

      const text = document.createElement('p');
      text.className = 'review-text';
      text.textContent = r.text;

      const meta = document.createElement('div');
      meta.className = 'review-meta';
      const name = document.createElement('strong');
      name.textContent = r.name;
      const date = document.createElement('span');
      date.textContent = formatDate(r.date);
      meta.append(name, date);

      card.append(stars, text, meta);

      if (CONFIG.googleReviewUrl) {
        const a = document.createElement('a');
        a.href = CONFIG.googleReviewUrl;
        a.target = '_blank';
        a.rel = 'noopener';
        a.className = 'posted-on';
        a.textContent = 'Posted on Google';
        card.append(a);
      }
      track.appendChild(card);
    });

    // Arrow buttons: move one card at a time, wrapping at the ends
    const prevR = $('[data-reviews-prev]');
    const nextR = $('[data-reviews-next]');
    const step = () => {
      const card = track.querySelector('.review-card');
      const gap = parseFloat(getComputedStyle(track).columnGap) || 20;
      return card ? card.getBoundingClientRect().width + gap : track.clientWidth;
    };
    if (nextR) nextR.addEventListener('click', () => {
      if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 8) track.scrollTo({ left: 0, behavior: 'smooth' });
      else track.scrollBy({ left: step(), behavior: 'smooth' });
    });
    if (prevR) prevR.addEventListener('click', () => {
      if (track.scrollLeft <= 8) track.scrollTo({ left: track.scrollWidth, behavior: 'smooth' });
      else track.scrollBy({ left: -step(), behavior: 'smooth' });
    });
  }

  // ---- Load data on the home page ----
  if ($('.carousel-stage')) {
    fetch('assets/data/carousel.json')
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(initCarousel)
      .catch(() => {
        const stage = $('.carousel-stage');
        if (stage) stage.textContent = 'Photos could not be loaded right now.';
      });
  }

  if ($('[data-reviews]')) {
    if (CONFIG.googleReviewUrl) { /* link is added per card in renderReviews */ }
    fetch('assets/data/reviews.json')
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(renderReviews)
      .catch(() => {
        const track = $('[data-reviews]');
        if (track) track.innerHTML = '<p class="reviews-status">Reviews could not be loaded right now.</p>';
      });
  }
})();
