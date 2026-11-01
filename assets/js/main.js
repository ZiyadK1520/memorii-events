/* ==========================================================================
   Memorii Events — main script
   --------------------------------------------------------------------------
   1. Settings
   2. Mobile menu
   3. Hero carousel (coverflow)
        - photos show for 3 s, videos for 5 s
        - hovering (mouse) or tapping the centre video lets it play to the end
        - videos are always muted
        - arrows, keyboard arrows, swipe, pause button
        - only the current item and its two neighbours are loaded
   4. Reviews (reads assets/data/reviews.json and shows every review)
   5. Forms (yyyy-mm-dd dates: real and not in the past; no double submits)
   6. Booking popup (opened by the Events We Serve cards)
   ========================================================================== */
(function () {
  'use strict';

  /* 1. Settings ----------------------------------------------------------- */
  var CONFIG = {
    photoMs: 3000,   // how long each photo stays in the centre
    videoMs: 5000,   // how long each video plays, unless hovered or tapped
    googleReviewUrl: 'https://share.google/uXJxlVjsRoBqMtUKE'
  };

  function $(sel, root) { return (root || document).querySelector(sel); }

  initNav();
  initCarousel();
  initReviews();
  initForms();
  initBookingPopup();

  /* 2. Mobile menu -------------------------------------------------------- */
  function initNav() {
    var toggle = $('.menu-toggle');
    var nav = $('#site-nav');
    if (!toggle || !nav) return;

    function setOpen(open) {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }

    toggle.addEventListener('click', function () {
      setOpen(!nav.classList.contains('is-open'));
    });
    // Close after choosing a link (needed for the FAQ jump link)
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
    var desktop = window.matchMedia('(min-width: 900px)');
    var onChange = function (e) { if (e.matches) setOpen(false); };
    if (desktop.addEventListener) desktop.addEventListener('change', onChange);
  }

  /* 3. Hero carousel (coverflow) ------------------------------------------ */
  function initCarousel() {
    var stage = $('[data-carousel]');
    if (!stage) return;

    fetch(stage.getAttribute('data-src'))
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (items) {
        items = (items || []).filter(function (i) { return i && i.src; });
        if (!items.length) throw new Error('empty');
        buildCarousel(stage, items);
      })
      .catch(function () {
        $('.cf-track', stage).innerHTML =
          '<p class="cf-error">Our event photos didn’t load. Refresh the page to try again.</p>';
      });
  }

  function buildCarousel(stage, items) {
    var track = $('.cf-track', stage);
    var countEl = $('.cf-count', stage);
    var statusEl = $('.cf-status', stage);
    var prevBtn = $('.cf-prev', stage);
    var nextBtn = $('.cf-next', stage);
    var pauseBtn = $('.cf-pause', stage);

    var n = items.length;
    var current = 0;
    var timer = null;
    var paused = false;

    // Build one slide per item. Files are attached later, only when needed.
    var slides = items.map(function (item, i) {
      var isVideo = item.type === 'video';
      var el = document.createElement('div');
      el.className = 'cf-item is-hidden';
      el.setAttribute('role', 'group');
      el.setAttribute('aria-roledescription', 'slide');
      el.setAttribute('aria-label', (i + 1) + ' of ' + n);
      el.setAttribute('aria-hidden', 'true');

      var media = document.createElement(isVideo ? 'video' : 'img');
      media.className = 'cf-media';
      if (isVideo) {
        // Always muted, always inline: these videos never play with sound.
        media.muted = true;
        media.defaultMuted = true;
        media.playsInline = true;
        media.setAttribute('muted', '');
        media.setAttribute('playsinline', '');
        media.setAttribute('disablepictureinpicture', '');
        media.setAttribute('aria-label', item.alt || '');
        media.preload = 'none';
      } else {
        media.alt = item.alt || '';
        media.decoding = 'async';
        media.draggable = false;
      }
      el.appendChild(media);
      track.appendChild(el);

      var slide = {
        el: el,
        media: media,
        item: item,
        isVideo: isVideo,
        // Start from the size in carousel.json, then use the real size once loaded
        aspect: item.width && item.height ? item.width / item.height : (isVideo ? 9 / 16 : 3 / 2)
      };

      if (isVideo) {
        media.addEventListener('loadedmetadata', function () {
          if (media.videoWidth && media.videoHeight) {
            slide.aspect = media.videoWidth / media.videoHeight;
            layout();
          }
        });
        // A video that finishes moves the carousel on (this is how a held video advances)
        media.addEventListener('ended', function () {
          if (slides[current] === slide && !paused) go(current + 1);
        });
        // Mouse hover on the centre video: let it play to the end
        el.addEventListener('pointerenter', function (e) {
          if (e.pointerType === 'mouse' && slides[current] === slide) hold();
        });
      } else {
        media.addEventListener('load', function () {
          if (media.naturalWidth && media.naturalHeight) {
            slide.aspect = media.naturalWidth / media.naturalHeight;
            layout();
          }
        });
      }
      return slide;
    });

    /* Loading: the centre gets the full file; neighbours get a light preview */
    function load(slide, isCentre) {
      var m = slide.media;
      if (slide.isVideo) {
        if (slide.item.poster && !m.getAttribute('poster')) m.setAttribute('poster', slide.item.poster);
        if (!m.getAttribute('src')) {
          m.preload = isCentre ? 'auto' : 'metadata';
          m.src = slide.item.src;
        } else if (isCentre) {
          m.preload = 'auto';
        }
      } else if (!m.getAttribute('src')) {
        m.src = slide.item.src;
      }
    }

    /* Position of slide i relative to the centre: 0 centre, -1 left, 1 right */
    function offset(i) {
      var d = ((i - current) % n + n) % n;
      if (d > n / 2) d -= n;
      return d;
    }

    /* Size and place every slide.
       The centre frame takes the item's real shape, so portrait videos are
       shown whole. The neighbours stretch to fill the space on either side. */
    function layout() {
      var W = track.clientWidth;
      var H = track.clientHeight;
      if (!W || !H) return;

      var narrow = W < 700;
      stage.classList.toggle('is-narrow', narrow);
      var centre = slides[current];
      var maxW = W * (narrow ? 0.88 : 0.64);

      var ch = H;
      var cw = ch * centre.aspect;
      if (cw > maxW) { cw = maxW; ch = cw / centre.aspect; }
      var cx = (W - cw) / 2;
      var cy = (H - ch) / 2;

      // How far the neighbours tuck in behind the centre card
      var tuck = Math.min(cw * 0.16, 90);
      var sw = Math.max((W - cw) / 2 + tuck, W * 0.14);
      var sh = Math.min(H * 0.84, Math.max(ch * 0.9, H * 0.5));
      var sy = (H - sh) / 2;

      // Phones: the neighbours each fill half the stage, top to bottom, behind
      // the centre card, so any space around a landscape photo is filled too.
      // They overlap in the middle and cross-fade, so there's no seam.
      if (narrow) {
        sw = W * 0.7;
        tuck = sw - cx;
        sh = H;
        sy = 0;
      }

      slides.forEach(function (s, i) {
        var d = offset(i);
        var x, y, w, h, role;
        if (d === 0) { w = cw; h = ch; x = cx; y = cy; role = 'is-center'; }
        else if (d === -1) { w = sw; h = sh; x = cx + tuck - sw; y = sy; role = 'is-prev'; }
        else if (d === 1) { w = sw; h = sh; x = cx + cw - tuck; y = sy; role = 'is-next'; }
        else {
          // Waiting off to the side, invisible, ready to slide in
          w = sw; h = sh * 0.9; y = (H - h) / 2; role = 'is-hidden';
          x = d < 0 ? cx + tuck - sw * 1.35 : cx + cw - tuck + sw * 0.35;
        }
        s.el.style.width = w + 'px';
        s.el.style.height = h + 'px';
        s.el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
        s.el.className = 'cf-item ' + role;
        s.el.setAttribute('aria-hidden', d === 0 ? 'false' : 'true');
      });
    }

    function clearTimer() {
      if (timer) { clearTimeout(timer); timer = null; }
    }

    /* Start the timer for the centre item (and play it if it's a video) */
    function start(fromBeginning) {
      clearTimer();
      var s = slides[current];
      if (s.isVideo) {
        if (fromBeginning) { try { s.media.currentTime = 0; } catch (e) { /* not ready yet */ } }
        if (paused) { s.media.pause(); return; }
        var p = s.media.play();
        if (p && p.catch) p.catch(function () { /* autoplay blocked: the timer still advances */ });
      }
      if (paused) return;
      timer = setTimeout(function () { go(current + 1); }, s.isVideo ? CONFIG.videoMs : CONFIG.photoMs);
    }

    /* Hover or tap on the centre video: cancel the 5 s timer.
       The "ended" event moves on when the video finishes. */
    function hold() {
      if (paused || !slides[current].isVideo) return;
      clearTimer();
    }

    function go(i, announce) {
      var old = slides[current];
      current = ((i % n) + n) % n;
      if (old !== slides[current] && old.isVideo) old.media.pause();

      load(slides[current], true);
      load(slides[(current + 1) % n], false);
      load(slides[(current - 1 + n) % n], false);
      layout();

      countEl.textContent = (current + 1) + ' / ' + n;
      // Screen readers only hear updates the visitor asked for, not every auto-advance
      if (announce) statusEl.textContent = 'Showing ' + (current + 1) + ' of ' + n + ': ' + (slides[current].item.alt || '');
      start(true);
    }

    /* Controls ------------------------------------------------------------ */
    prevBtn.addEventListener('click', function () { go(current - 1, true); });
    nextBtn.addEventListener('click', function () { go(current + 1, true); });

    pauseBtn.addEventListener('click', function () {
      paused = !paused;
      stage.classList.toggle('is-paused', paused);
      pauseBtn.setAttribute('aria-label', paused ? 'Play slideshow' : 'Pause slideshow');
      pauseBtn.setAttribute('aria-pressed', String(paused));
      if (paused) {
        clearTimer();
        if (slides[current].isVideo) slides[current].media.pause();
      } else {
        start(false);
      }
    });

    stage.addEventListener('keydown', function (e) {
      if (e.target !== stage) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(current + 1, true); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(current - 1, true); }
    });

    /* Swipe and tap. A swipe moves the carousel; a tap (little movement)
       holds the centre video, or brings a side item to the centre. */
    var startX = null, startY = null, pointerId = null;
    track.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      startX = e.clientX; startY = e.clientY; pointerId = e.pointerId;
    });
    track.addEventListener('pointerup', function (e) {
      if (startX === null || e.pointerId !== pointerId) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      startX = null;

      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        go(current + (dx < 0 ? 1 : -1), true);
        return;
      }
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        var el = e.target.closest('.cf-item');
        if (!el) return;
        var idx = -1;
        for (var k = 0; k < slides.length; k++) { if (slides[k].el === el) { idx = k; break; } }
        var d = offset(idx);
        if (d === 0) hold();
        else if (d === -1) go(current - 1, true);
        else if (d === 1) go(current + 1, true);
      }
    });
    track.addEventListener('pointercancel', function () { startX = null; });

    /* Keep things tidy when the tab is hidden or the window is resized */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        clearTimer();
        if (slides[current].isVideo) slides[current].media.pause();
      } else if (!paused) {
        start(false);
      }
    });
    if ('ResizeObserver' in window) {
      new ResizeObserver(function () { layout(); }).observe(track);
    } else {
      window.addEventListener('resize', layout);
    }

    // Place everything once without animation, then switch animation on
    track.classList.add('no-anim');
    go(0);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { track.classList.remove('no-anim'); });
    });
  }

  /* 4. Reviews ------------------------------------------------------------ */
  var STAR = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2.6l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5L2.5 9.4l6.6-.8z"/></svg>';
  var QUOTE = '<svg class="review-quote" viewBox="0 0 40 40" aria-hidden="true" fill="currentColor"><path d="M17 9C9.8 11.2 5 16.6 5 24.2 5 29 8 32 11.9 32c3.5 0 6-2.6 6-5.9 0-3.2-2.3-5.6-5.4-5.7.8-3.6 3.6-6.4 7.5-7.8L17 9zm17 0c-7.2 2.2-12 7.6-12 15.2 0 4.8 3 7.8 6.9 7.8 3.5 0 6-2.6 6-5.9 0-3.2-2.3-5.6-5.4-5.7.8-3.6 3.6-6.4 7.5-7.8L34 9z"/></svg>';

  function initReviews() {
    var track = $('[data-reviews]');
    if (!track) return;

    fetch(track.getAttribute('data-src'))
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (list) { renderReviews(track, list || []); })
      .catch(function () {
        track.innerHTML = '<p class="reviews-status">Reviews didn’t load. Refresh the page to try again.</p>';
      });

    // Arrows move one card at a time and wrap around at the ends
    var prev = $('[data-reviews-prev]');
    var next = $('[data-reviews-next]');
    function step() {
      var card = track.querySelector('.review-card');
      var gap = parseFloat(getComputedStyle(track).columnGap) || 20;
      return card ? card.getBoundingClientRect().width + gap : track.clientWidth;
    }
    if (next) next.addEventListener('click', function () {
      var atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
      track.scrollTo({ left: atEnd ? 0 : track.scrollLeft + step() });
    });
    if (prev) prev.addEventListener('click', function () {
      var atStart = track.scrollLeft <= 8;
      track.scrollTo({ left: atStart ? track.scrollWidth : track.scrollLeft - step() });
    });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' && next) { e.preventDefault(); next.click(); }
      if (e.key === 'ArrowLeft' && prev) { e.preventDefault(); prev.click(); }
    });
  }

  function formatDate(s) {
    var d = new Date(s + 'T00:00:00');
    return isNaN(d) ? s : d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  // Every review in the file is shown. The "featured" field is ignored on purpose.
  function renderReviews(track, list) {
    track.innerHTML = '';
    list.forEach(function (r) {
      var rating = Math.max(0, Math.min(5, Math.round(Number(r.rating) || 0)));

      var card = document.createElement('article');
      card.className = 'review-card';

      var top = document.createElement('div');
      top.className = 'review-top';
      top.innerHTML = QUOTE;
      var stars = document.createElement('div');
      stars.className = 'stars';
      stars.setAttribute('role', 'img');
      stars.setAttribute('aria-label', rating + ' out of 5 stars');
      for (var i = 0; i < 5; i++) {
        var span = document.createElement('span');
        if (i >= rating) span.className = 'is-empty';
        span.innerHTML = STAR;
        stars.appendChild(span);
      }
      top.appendChild(stars);

      var text = document.createElement('p');
      text.className = 'review-text';
      text.textContent = r.text || '';

      var meta = document.createElement('footer');
      meta.className = 'review-meta';
      var name = document.createElement('p');
      name.className = 'review-name';
      name.textContent = r.name || '';
      var date = document.createElement('time');
      date.className = 'review-date';
      date.dateTime = r.date || '';
      date.textContent = formatDate(r.date || '');
      meta.appendChild(name);
      meta.appendChild(date);

      if (CONFIG.googleReviewUrl) {
        var link = document.createElement('a');
        link.className = 'review-source';
        link.href = CONFIG.googleReviewUrl;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = 'Posted on Google';
        meta.appendChild(link);
      }

      card.appendChild(top);
      card.appendChild(text);
      card.appendChild(meta);
      track.appendChild(card);
    });
  }

  /* 5. Forms -------------------------------------------------------------- */
  // Returns a message if the date is wrong, or '' if it's fine.
  // Dates are typed as yyyy-mm-dd, must exist on the calendar, and can't be in the past.
  function dateProblem(value) {
    if (!value) return '';   // "required" handles empty fields
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Use the format yyyy-mm-dd, for example 2027-06-14.';
    var y = Number(value.slice(0, 4));
    var m = Number(value.slice(5, 7));
    var d = Number(value.slice(8, 10));
    var date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
      return 'That date doesn’t exist. Check the month and day.';
    }
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return 'Choose a date that hasn’t passed yet.';
    return '';
  }

  function checkDates(form) {
    Array.prototype.forEach.call(form.querySelectorAll('[data-date-field]'), function (input) {
      input.setCustomValidity(dateProblem(input.value.trim()));
    });
  }

  function initForms() {
    var forms = document.querySelectorAll('.enquiry-form');
    if (!forms.length) return;

    Array.prototype.forEach.call(forms, function (form) {
      var btn = form.querySelector('button[type="submit"]');

      // Re-check the date as people type, and right before the browser validates
      form.addEventListener('input', function (e) {
        if (e.target.matches('[data-date-field]')) checkDates(form);
      });
      if (btn) btn.addEventListener('click', function () { checkDates(form); });

      // The browser checks required fields first; this only runs on a valid form
      form.addEventListener('submit', function (e) {
        if (btn) {
          btn.disabled = true;
          btn.textContent = 'Sending…';
        }
      });
    });

    // If someone comes back with the browser's back button, re-enable the button
    window.addEventListener('pageshow', function () {
      Array.prototype.forEach.call(forms, function (form) {
        var btn = form.querySelector('button[type="submit"]');
        if (btn && btn.disabled) {
          btn.disabled = false;
          btn.textContent = btn.getAttribute('data-label') || 'Send';
        }
      });
    });
  }

  /* 6. Booking popup ------------------------------------------------------ */
  function initBookingPopup() {
    var dialog = $('#booking-dialog');
    if (!dialog) return;

    var form = $('form', dialog);
    var nameEl = $('[data-event-name]', dialog);
    var subject = form.querySelector('[name="_subject"]');
    var typeField = form.querySelector('[name="event_type"]');
    var status = $('.form-status', dialog);
    var opener = null;

    function open(eventName, button) {
      opener = button;
      nameEl.textContent = eventName;
      subject.value = 'New booking request - ' + eventName;
      typeField.value = eventName;
      status.textContent = '';
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      document.body.classList.add('dialog-open');
      var first = $('#popup-name', dialog);
      if (first) first.focus();
    }

    function close() {
      if (typeof dialog.close === 'function') dialog.close();
      else { dialog.removeAttribute('open'); onClosed(); }
    }

    // Put focus back on the card that opened the popup
    function onClosed() {
      document.body.classList.remove('dialog-open');
      if (opener) opener.focus();
    }
    dialog.addEventListener('close', onClosed);

    Array.prototype.forEach.call(document.querySelectorAll('.event-open'), function (button) {
      button.addEventListener('click', function () { open(button.getAttribute('data-event'), button); });
    });

    $('.dialog-close', dialog).addEventListener('click', close);

    // A click on the dark backdrop lands on the <dialog> itself, outside the panel
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) close();
    });

    // Escape closes the popup (built into <dialog>; this covers older browsers)
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && dialog.hasAttribute('open')) close();
    });
  }
})();
