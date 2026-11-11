/* Rekindled home page behaviour (replaces the Tilda runtime). No dependencies. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var isTouch = 'ontouchend' in document;

  /* ------------------------------------------------------------ artboard scale */
  // The inline script in <head> sets --zs once; keep it in sync with the viewport
  // (resizes, orientation changes and the scrollbar appearing all change clientWidth).
  var baseUpdateScale = window.__updateArtboardScale || function () {};
  var updateScale = function () {
    // While the burger menu locks page scrolling the scrollbar disappears; keep the
    // current scale so the (hidden) page behind the menu does not jump.
    if (document.body && document.body.classList.contains('mnav-lock')) return;
    baseUpdateScale();
  };
  updateScale();
  if ('ResizeObserver' in window) {
    new ResizeObserver(updateScale).observe(root);
  } else {
    window.addEventListener('resize', updateScale);
  }

  /* ------------------------------------------------------------ appear-on-scroll */
  // Tilda only runs these animations when the window is at least 1200px wide.
  var animated = document.querySelectorAll('[data-anim]');
  if (window.innerWidth >= 1200 && !reduceMotion.matches && 'IntersectionObserver' in window && animated.length) {
    root.classList.add('anim-on');
    var appearObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          appearObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0 });
    animated.forEach(function (el) { appearObserver.observe(el); });
  }

  /* ------------------------------------------------------------ mouse parallax (About section) */
  // Port of Tilda's "parallax on mouse move": each element drifts up to dx/dy px
  // opposite to the cursor, eased towards the target on every frame.
  var parallaxEls = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
  if (parallaxEls.length && !reduceMotion.matches && !(isTouch && root.clientWidth < 1200) && window.innerWidth >= 1200) {
    var items = parallaxEls.map(function (el) {
      var p = el.getAttribute('data-parallax').split(' ');
      return { el: el.firstElementChild, section: el.closest('.zb'), dx: +p[0] || 0, dy: +p[1] || 0, x: 0, y: 0, tx: 0, ty: 0 };
    });
    var running = false;
    var tick = function () {
      var moving = false;
      items.forEach(function (it) {
        it.x += 0.02 * (it.tx - it.x);
        it.y += 0.02 * (it.ty - it.y);
        if (Math.abs(it.x - it.tx) >= 1 || Math.abs(it.y - it.ty) >= 1) moving = true;
        it.el.style.translate = it.x.toFixed(2) + 'px ' + it.y.toFixed(2) + 'px';
      });
      running = moving;
      if (moving) requestAnimationFrame(tick);
    };
    var lastMove = 0;
    document.addEventListener('mousemove', function (e) {
      var now = Date.now();
      if (now - lastMove < 50) return;
      lastMove = now;
      var w = window.innerWidth / 2, h = window.innerHeight / 2;
      items.forEach(function (it) {
        var r = it.section.getBoundingClientRect();
        if (e.clientY < r.top || e.clientY > r.bottom) return; // only react while the cursor is over the section
        it.tx = Math.round(it.dx * (w - e.clientX) / w);
        it.ty = Math.round(it.dy * (h - e.clientY) / h);
      });
      if (!running) { running = true; requestAnimationFrame(tick); }
    }, { passive: true });
  }

  /* ------------------------------------------------------------ compact header / burger menu */
  var mnav = document.getElementById('mnav');
  if (mnav) {
    var burger = mnav.querySelector('.mnav__burger');
    var setMenu = function (open) {
      mnav.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.classList.toggle('mnav-lock', open);
      if (!open) updateScale();
    };
    burger.addEventListener('click', function () { setMenu(!mnav.classList.contains('is-open')); });
    mnav.querySelectorAll('.mnav__menu a').forEach(function (a) {
      a.addEventListener('click', function () { setMenu(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mnav.classList.contains('is-open')) { setMenu(false); burger.focus(); }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 960 && mnav.classList.contains('is-open')) setMenu(false);
    });

    // Highlight the menu link of the section currently on screen; white bar after scrolling (961-980px).
    var links = Array.prototype.slice.call(mnav.querySelectorAll('.mnav__link'));
    var targets = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
    var onScroll = function () {
      var y = window.pageYOffset;
      mnav.classList.toggle('is-scrolled', y > 20);
      var active = 0;
      var probe = y + window.innerHeight / 3;
      targets.forEach(function (t, i) {
        if (t && t.getBoundingClientRect().top + y <= probe) active = i;
      });
      if (window.innerHeight + y >= document.documentElement.scrollHeight - 2) active = targets.length - 1;
      links.forEach(function (a, i) { a.classList.toggle('is-active', i === active); });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ------------------------------------------------------------ reviews slider */
  var slider = document.getElementById('reviews-slider');
  if (slider) {
    var slides = Array.prototype.slice.call(slider.children);
    // Arrow buttons move one card at a time and wrap around at either end (as on Tilda).
    var go = function (dir) {
      var padLeft = parseFloat(getComputedStyle(slider).paddingLeft) || 0;
      var sRect = slider.getBoundingClientRect();
      var current = slider.scrollLeft;
      var max = slider.scrollWidth - slider.clientWidth;
      var positions = slides.map(function (s) {        // snap position of every card
        return Math.min(max, s.getBoundingClientRect().left - sRect.left + current - padLeft);
      });
      var target;
      if (dir > 0) {
        target = current >= max - 2 ? positions[0] : positions.filter(function (p) { return p > current + 2; })[0];
        if (target === undefined) target = max;
      } else {
        var prev = positions.filter(function (p) { return p < current - 2; });
        target = current <= positions[0] + 2 ? max : (prev.length ? prev[prev.length - 1] : positions[0]);
      }
      slider.scrollTo({ left: target, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    };
    var prevBtn = document.querySelector('.reviews__control--prev');
    var nextBtn = document.querySelector('.reviews__control--next');
    if (prevBtn) prevBtn.addEventListener('click', function () { go(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { go(1); });

    // Mouse drag (touch devices swipe natively thanks to overflow scrolling + scroll snap).
    var drag = null;
    slider.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      drag = { x: e.clientX, left: slider.scrollLeft, active: false };
    });
    window.addEventListener('mousemove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      if (!drag.active && Math.abs(dx) > 10) {
        drag.active = true;
        slider.classList.add('is-dragging');
        slider.style.scrollSnapType = 'none';
      }
      if (drag.active) {
        e.preventDefault();
        slider.scrollLeft = drag.left - 1.5 * dx;
      }
    });
    window.addEventListener('mouseup', function () {
      if (!drag) return;
      var wasActive = drag.active;
      drag = null;
      if (!wasActive) return;
      // let the browser settle on the nearest snap point
      var left = slider.scrollLeft;
      slider.style.scrollSnapType = '';
      slider.scrollLeft = left;
      setTimeout(function () { slider.classList.remove('is-dragging'); }, 50);
    });
    slider.addEventListener('dragstart', function (e) { e.preventDefault(); });
  }

  /* ------------------------------------------------------------ contact form */
  var form = document.getElementById('contact-form');
  if (form) {
    var MSG = {
      email: 'Please enter a valid email address',
      name: 'Please put a name',
      empty: 'None of the fields are filled in',
      success: 'Thank you! Your data has been submitted.'
    };
    var SUPPORT = 'support@rekindledapp.com';
    var fields = form.querySelector('.form__fields');
    var errorbox = form.querySelector('.form__errorbox');
    var success = form.querySelector('.form__success');
    var submit = form.querySelector('.form__submit');
    var emailInput = form.elements.Email;
    var nameInput = form.elements.Name;
    var messageInput = form.elements.Textarea;

    var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    var nameRe = /^[\p{L}\p{M}\s'’.\-]+$/u;

    var setFieldError = function (input, message) {
      var group = input.closest('.form__group');
      var err = group.querySelector('.form__error');
      group.classList.toggle('has-error', !!message);
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
      if (err) err.textContent = message || '';
    };
    var showErrors = function (messages, html) {
      errorbox.innerHTML = '';
      if (!messages.length && !html) { errorbox.hidden = true; return; }
      messages.forEach(function (m) {
        var p = document.createElement('p');
        p.textContent = m;
        errorbox.appendChild(p);
      });
      if (html) errorbox.appendChild(html);
      errorbox.hidden = false;
    };

    var validate = function () {
      var errors = [];
      var email = emailInput.value.trim();
      var name = nameInput.value.trim();
      var message = messageInput.value.trim();
      setFieldError(emailInput, '');
      setFieldError(nameInput, '');
      if (!email && !name && !message) {
        errors.push(MSG.empty);
        return errors;
      }
      if (email && !emailRe.test(email)) { setFieldError(emailInput, MSG.email); errors.push(MSG.email); }
      if (name && !nameRe.test(name)) { setFieldError(nameInput, MSG.name); errors.push(MSG.name); }
      return errors;
    };

    var mailtoFallback = function () {
      var body = 'Name: ' + nameInput.value.trim() + '\nEmail: ' + emailInput.value.trim() + '\n\n' + messageInput.value.trim();
      var href = 'mailto:' + SUPPORT + '?subject=' + encodeURIComponent('Rekindled support request') + '&body=' + encodeURIComponent(body);
      var p = document.createElement('p');
      p.appendChild(document.createTextNode('Sorry, the message could not be sent. Please email us at '));
      var a = document.createElement('a');
      a.href = href;
      a.textContent = SUPPORT;
      p.appendChild(a);
      return p;
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submit.classList.contains('is-sending')) return;
      var errors = validate();
      if (errors.length) { showErrors(errors); return; }
      showErrors([]);
      submit.classList.add('is-sending');
      submit.setAttribute('aria-busy', 'true');

      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          name: nameInput.value.trim(),
          email: emailInput.value.trim(),
          message: messageInput.value.trim(),
          company: form.elements.company ? form.elements.company.value : ''
        })
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok || !data.ok) throw new Error(data.error || 'Request failed');
          return data;
        });
      }).then(function () {
        fields.hidden = true;
        success.textContent = MSG.success;
        success.hidden = false;
        form.reset();
      }).catch(function () {
        showErrors([], mailtoFallback());
        errorbox.focus({ preventScroll: true });
      }).then(function () {
        submit.classList.remove('is-sending');
        submit.removeAttribute('aria-busy');
      });
    });
  }
})();
