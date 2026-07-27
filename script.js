(() => {
  'use strict';

  const qs = (selector, context = document) => context.querySelector(selector);
  const qsa = (selector, context = document) => Array.from(context.querySelectorAll(selector));
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;



  /* =========================================================
     ONLINE PHOTOGRAPHY + LOCAL JPG FALLBACK
     Restores the original web photography while keeping every
     image backed by a bundled JPG if the network is unavailable.
  ========================================================== */
  qsa('img[data-local-src]').forEach((img) => {
    const local = img.dataset.localSrc;
    img.addEventListener('error', () => {
      if (!local || img.dataset.fallbackApplied === 'true') return;
      img.dataset.fallbackApplied = 'true';
      img.src = local;
    });
  });



  /* =========================================================
     V27 STATIC ICON + SINGLE CLIP-PATH MENU REVEAL
     - Icons never move and have no animation.
     - Opening reveals from bottom to top.
     - Closing disappears from bottom to top.
     - Only one menu controller exists.
  ========================================================== */
  const staticMenu = qs('#raumStaticMenu');
  const staticMenuButton = qs('#raumStaticMenuButton');
  const staticMenuLinks = qsa('.raum-static-menu-links a');
  const staticMenuPanel = qs('.raum-static-menu-panel');
  const staticMenuDuration = reduceMotion ? 20 : 760;
  let staticMenuOpen = false;
  let staticMenuAnimating = false;
  let staticMenuTimer = 0;

  const openStaticMenu = () => {
    if (!staticMenu || !staticMenuButton || staticMenuOpen || staticMenuAnimating) return;
    staticMenuOpen = true;
    staticMenuAnimating = true;
    window.clearTimeout(staticMenuTimer);

    staticMenu.classList.remove('is-closing');
    staticMenu.classList.add('is-active');
    staticMenu.setAttribute('aria-hidden', 'false');
    staticMenuButton.setAttribute('aria-expanded', 'true');
    staticMenuButton.setAttribute('aria-label', 'Close menu');
    document.body.classList.add('raum-static-menu-lock');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => staticMenu.classList.add('is-open'));
    });

    staticMenuTimer = window.setTimeout(() => {
      staticMenuAnimating = false;
    }, staticMenuDuration);
  };

  const closeStaticMenu = () => {
    if (!staticMenu || !staticMenuButton || !staticMenuOpen || staticMenuAnimating) return;
    staticMenuOpen = false;
    staticMenuAnimating = true;
    window.clearTimeout(staticMenuTimer);

    staticMenu.classList.add('is-closing');
    staticMenu.classList.remove('is-open');
    staticMenu.setAttribute('aria-hidden', 'true');
    staticMenuButton.setAttribute('aria-expanded', 'false');
    staticMenuButton.setAttribute('aria-label', 'Open menu');

    staticMenuTimer = window.setTimeout(() => {
      // Reset the hidden panel instantly to its opening start position.
      // This prevents the direction from reversing on the next open.
      staticMenu.classList.add('is-resetting');
      staticMenu.classList.remove('is-closing', 'is-open');
      if (staticMenuPanel) void staticMenuPanel.offsetHeight;
      staticMenu.classList.remove('is-active');
      document.body.classList.remove('raum-static-menu-lock');
      requestAnimationFrame(() => staticMenu.classList.remove('is-resetting'));
      staticMenuAnimating = false;
    }, staticMenuDuration);
  };

  staticMenuButton?.addEventListener('click', () => {
    if (staticMenuAnimating) return;
    staticMenuOpen ? closeStaticMenu() : openStaticMenu();
  });

  staticMenuLinks.forEach((link) => {
    link.addEventListener('click', () => {
      if (staticMenuOpen && !staticMenuAnimating) closeStaticMenu();
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && staticMenuOpen && !staticMenuAnimating) closeStaticMenu();
  });

  /* Keep the responsive local hero videos playing reliably. */
  const heroVideos = qsa('.hero-video');

  const isVideoVisible = (video) => window.getComputedStyle(video).display !== 'none';

  const startVisibleHeroVideo = async () => {
    for (const video of heroVideos) {
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');

      if (!isVideoVisible(video)) {
        if (!video.paused) video.pause();
        continue;
      }

      try {
        await video.play();
      } catch (_) {
        // Embedded previews can postpone autoplay until a user gesture.
      }
    }
  };

  heroVideos.forEach((video) => {
    video.addEventListener('canplay', startVisibleHeroVideo, { once: true });
    video.addEventListener('loadedmetadata', startVisibleHeroVideo, { once: true });
  });
  window.addEventListener('pageshow', startVisibleHeroVideo);
  window.addEventListener('resize', startVisibleHeroVideo);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) startVisibleHeroVideo();
  });
  document.addEventListener('pointerdown', startVisibleHeroVideo, { once: true });
  startVisibleHeroVideo();

  /* =========================================================
     SCROLL-READING TEXT
     The whole sentence starts at 25% opacity. As the reader
     scrolls through it, every word progressively reaches 100%.
  ========================================================== */
  const scrollReadElements = qsa('.scroll-read');

  const splitIntoWords = (element) => {
    if (element.dataset.wordsReady === 'true') return;
    const text = element.textContent.replace(/\s+/g, ' ').trim();
    if (!text) return;

    element.dataset.wordsReady = 'true';
    element.setAttribute('aria-label', text);
    element.textContent = '';

    text.split(' ').forEach((word, index, words) => {
      const span = document.createElement('span');
      span.className = 'read-word';
      span.style.setProperty('--word-progress', '0');
      span.textContent = word;
      span.setAttribute('aria-hidden', 'true');
      element.appendChild(span);
      if (index < words.length - 1) element.appendChild(document.createTextNode(' '));
    });
  };

  scrollReadElements.forEach(splitIntoWords);

  const updateReadingText = () => {
    if (reduceMotion) {
      qsa('.read-word').forEach((word) => word.style.setProperty('--word-progress', '1'));
      return;
    }

    const viewport = window.innerHeight;
    scrollReadElements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      const words = qsa('.read-word', element);
      if (!words.length || rect.bottom < -120 || rect.top > viewport + 120) return;

      // Sticky featured-story copy needs to follow the section's internal
      // scroll journey instead of the element's fixed viewport position.
      const storySection = element.closest('.feature-story');
      let globalProgress;

      if (storySection) {
        const sectionRect = storySection.getBoundingClientRect();
        const startLine = viewport * 0.78;
        const journey = Math.max(viewport * 0.9, sectionRect.height - viewport * 0.28);
        globalProgress = clamp((startLine - sectionRect.top) / journey);

        // The paragraph follows slightly after the featured title, while both
        // continue progressing until the end of the pinned section.
        if (element.matches('.story-sticky p')) {
          globalProgress = clamp((globalProgress - 0.18) / 0.82);
        }
      } else {
        // Standard reading zone for non-sticky sections.
        const travel = viewport * 0.72 + rect.height * 0.42;
        globalProgress = clamp((viewport * 0.84 - rect.top) / travel);
      }

      const revealWindow = Math.max(0.1, Math.min(0.2, 7 / words.length));

      words.forEach((word, index) => {
        const start = (index / Math.max(1, words.length - 1)) * (1 - revealWindow);
        const localProgress = clamp((globalProgress - start) / revealWindow);
        word.style.setProperty('--word-progress', localProgress.toFixed(3));
      });
    });
  };

  /* =========================================================
     SCROLL-GATED IMAGE REVEALS
     Each photo is observed only after the visitor starts scrolling.
     The frame stays grey underneath while the photo rises upward with the original premium timing.
  ========================================================== */
  let userHasScrolled = window.scrollY > 4;
  const imageFrames = qsa('.anim-image');
  let imageObserverStarted = false;
  let imageObserver = null;

  if (!reduceMotion) {
    document.documentElement.classList.add('motion-ready');
  } else {
    imageFrames.forEach((element) => element.classList.add('mask-in', 'reveal-complete'));
  }

  const completeImageReveal = (frame) => {
    if (frame.classList.contains('reveal-complete')) return;
    frame.classList.add('reveal-complete');
  };

  const revealImageFrame = (frame) => {
    if (frame.classList.contains('mask-in')) return;
    frame.classList.add('mask-in');
    const image = qs('img', frame);
    if (image) {
      const onTransitionEnd = (event) => {
        if (event.propertyName !== 'clip-path' && event.propertyName !== 'transform') return;
        image.removeEventListener('transitionend', onTransitionEnd);
        completeImageReveal(frame);
      };
      image.addEventListener('transitionend', onTransitionEnd);
    }
    window.setTimeout(() => completeImageReveal(frame), 1300);
  };

  const startImageObserver = () => {
    if (reduceMotion || imageObserverStarted) return;
    imageObserverStarted = true;

    if (!('IntersectionObserver' in window)) {
      imageFrames.forEach(revealImageFrame);
      return;
    }

    imageObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        revealImageFrame(entry.target);
        imageObserver.unobserve(entry.target);
      });
    }, {
      threshold: 0.08,
      rootMargin: '0px 0px -12% 0px'
    });

    imageFrames.forEach((frame) => imageObserver.observe(frame));
  };

  const revealTitleMasksOnScroll = () => {
    if (reduceMotion || !userHasScrolled) return;
    qsa('.title-mask:not(.title-in)').forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.top <= window.innerHeight * 0.82 && rect.bottom > 0) {
        element.classList.add('title-in');
      }
    });
  };

  if (!reduceMotion && 'IntersectionObserver' in window) {
    const liftObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const element = entry.target;
        element.animate(
          [
            { clipPath: 'inset(0 0 100% 0)', transform: 'translate3d(0, 1.1em, 0)' },
            { clipPath: 'inset(0 0 0% 0)', transform: 'translate3d(0, 0, 0)' }
          ],
          {
            duration: 950,
            delay: Number(element.dataset.delay || 0),
            easing: 'cubic-bezier(.16,1,.3,1)',
            fill: 'both'
          }
        );
        liftObserver.unobserve(element);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -3% 0px' });

    qsa('.lift-reveal').forEach((element, index) => {
      element.dataset.delay = String((index % 4) * 55);
      liftObserver.observe(element);
    });
  }

  /* =========================================================
     HERO ENTRANCE: MASKED TRANSLATION, NOT A FADE
  ========================================================== */
  if (!reduceMotion) {
    qsa('.hero-title span').forEach((element, index) => {
      element.animate(
        [
          { clipPath: 'inset(100% 0 0 0)', transform: 'translate3d(0, 42%, 0)' },
          { clipPath: 'inset(0 0 0 0)', transform: 'translate3d(0, 0, 0)' }
        ],
        {
          duration: 1250,
          delay: 100 + index * 110,
          fill: 'both',
          easing: 'cubic-bezier(.16,1,.3,1)'
        }
      );
    });

    qs('.nav')?.animate(
      [
        { clipPath: 'inset(0 0 100% 0)', transform: 'translate3d(0,-20px,0)' },
        { clipPath: 'inset(0 0 0 0)', transform: 'translate3d(0,0,0)' }
      ],
      { duration: 900, delay: 180, fill: 'both', easing: 'cubic-bezier(.16,1,.3,1)' }
    );

    qsa('.hero-topline,.hero-intro,.hero-button').forEach((element, index) => {
      element.animate(
        [
          { clipPath: 'inset(0 0 100% 0)', transform: 'translate3d(0,24px,0)' },
          { clipPath: 'inset(0 0 0 0)', transform: 'translate3d(0,0,0)' }
        ],
        { duration: 850, delay: 430 + index * 70, fill: 'both', easing: 'cubic-bezier(.16,1,.3,1)' }
      );
    });
  }

  /* =========================================================
     METRIC COUNTERS
  ========================================================== */
  const counters = qsa('.count-up');
  const setCounterValue = (element, value) => {
    const suffix = element.dataset.suffix || '';
    element.textContent = `${Math.round(value).toLocaleString('en-US')}${suffix}`;
  };

  const animateCounter = (element) => {
    if (element.dataset.counted === 'true') return;
    element.dataset.counted = 'true';
    const target = Number(element.dataset.target || 0);
    if (!Number.isFinite(target) || target < 1) return;

    if (reduceMotion) {
      setCounterValue(element, target);
      return;
    }

    const duration = target >= 500 ? 2100 : 1700;
    const startTime = performance.now();
    setCounterValue(element, 1);

    const tick = (now) => {
      const progress = clamp((now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      setCounterValue(element, 1 + (target - 1) * eased);
      if (progress < 1) requestAnimationFrame(tick);
      else setCounterValue(element, target);
    };
    requestAnimationFrame(tick);
  };

  if ('IntersectionObserver' in window) {
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      });
    }, { threshold: 0.55, rootMargin: '0px 0px -8% 0px' });

    counters.forEach((counter) => {
      setCounterValue(counter, 1);
      counterObserver.observe(counter);
    });
  } else {
    counters.forEach(animateCounter);
  }

  /* =========================================================
     MATERIAL SWITCH: preserve the currently selected image beneath
     the incoming bottom-up reveal. One click always switches once.
  ========================================================== */
  const materialPhoto = qs('#material-photo');
  let materialTransition = null;
  let materialLayer = null;
  let materialSwitchToken = 0;
  let materialPendingSource = '';
  let materialPendingAlt = '';

  const materialButtons = qsa('.material-tab');
  const getMaterialSource = (button) => button?.dataset.local || button?.dataset.online || '';

  materialButtons.forEach((button) => {
    const source = getMaterialSource(button);
    if (!source) return;
    const preload = new Image();
    preload.decoding = 'async';
    preload.src = source;
  });

  const waitForImage = (image) => new Promise((resolve, reject) => {
    if (image.complete && image.naturalWidth > 0) {
      resolve();
      return;
    }
    image.addEventListener('load', resolve, { once: true });
    image.addEventListener('error', reject, { once: true });
  });

  const commitMaterialBase = (source, alt = '') => {
    if (!materialPhoto || !source) return;
    materialPhoto.src = source;
    materialPhoto.alt = alt;
  };

  const clearMaterialLayer = () => {
    materialTransition?.cancel();
    materialTransition = null;
    materialLayer?.remove();
    materialLayer = null;
  };

  materialButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      if (!materialPhoto || button.classList.contains('active')) return;

      const wrapper = materialPhoto.parentElement;
      const source = getMaterialSource(button);
      const alt = button.dataset.alt || '';
      if (!wrapper || !source) return;

      /*
       * Before starting a new reveal, explicitly restore the image that
       * is currently selected as the base layer. This prevents Concrete
       * (the initial image) from reappearing behind later transitions.
       * If a previous transition is still running, its target becomes the
       * current base before the next reveal begins.
       */
      if (materialPendingSource) {
        commitMaterialBase(materialPendingSource, materialPendingAlt);
      } else {
        const currentButton = materialButtons.find((item) => item.classList.contains('active'));
        const currentSource = getMaterialSource(currentButton);
        if (currentSource) commitMaterialBase(currentSource, currentButton?.dataset.alt || '');
      }

      clearMaterialLayer();

      const token = ++materialSwitchToken;
      materialPendingSource = source;
      materialPendingAlt = alt;
      materialButtons.forEach((item) => item.classList.toggle('active', item === button));

      const layer = document.createElement('div');
      layer.className = 'material-transition-layer';
      const nextImage = document.createElement('img');
      nextImage.src = source;
      nextImage.alt = alt;
      nextImage.decoding = 'async';
      layer.appendChild(nextImage);
      wrapper.appendChild(layer);
      materialLayer = layer;

      try {
        await waitForImage(nextImage);
        if (token !== materialSwitchToken) {
          layer.remove();
          return;
        }
        if (typeof nextImage.decode === 'function') {
          try { await nextImage.decode(); } catch (_) {}
        }

        if (reduceMotion) {
          commitMaterialBase(source, alt);
          layer.remove();
          materialLayer = null;
          materialPendingSource = '';
          materialPendingAlt = '';
          return;
        }

        materialTransition = nextImage.animate(
          [
            { transform: 'translate3d(0,102%,0) scale(1.16)' },
            { transform: 'translate3d(0,0,0) scale(1.035)' }
          ],
          {
            duration: 1200,
            easing: 'cubic-bezier(.16,1,.3,1)',
            fill: 'forwards'
          }
        );

        materialTransition.onfinish = () => {
          if (token !== materialSwitchToken) return;
          commitMaterialBase(source, alt);
          layer.remove();
          materialLayer = null;
          materialTransition = null;
          materialPendingSource = '';
          materialPendingAlt = '';
        };

        materialTransition.oncancel = () => {
          layer.remove();
          if (materialLayer === layer) materialLayer = null;
          materialTransition = null;
        };
      } catch (_) {
        layer.remove();
        if (materialLayer === layer) materialLayer = null;
        if (token === materialSwitchToken) {
          commitMaterialBase(source, alt);
          materialPendingSource = '';
          materialPendingAlt = '';
        }
      }
    });
  });

  /* =========================================================
     MAGNETIC CTA
  ========================================================== */
  qsa('.magnetic').forEach((element) => {
    element.addEventListener('pointermove', (event) => {
      if (reduceMotion || event.pointerType === 'touch') return;
      const rect = element.getBoundingClientRect();
      const x = (event.clientX - rect.left - rect.width / 2) * 0.11;
      const y = (event.clientY - rect.top - rect.height / 2) * 0.11;
      element.style.transform = `translate3d(${x}px,${y}px,0)`;
    });
    element.addEventListener('pointerleave', () => { element.style.transform = ''; });
  });

  /* =========================================================
     SCROLL ENGINE: PROGRESS, HERO DEPTH, IMAGE PARALLAX,
     AND READING TEXT PROGRESS
  ========================================================== */
  const parallaxImages = qsa('.project-media img,.story-images img,.manifesto-photo img,.studio-media img');
  let ticking = false;

  const renderScroll = () => {
    ticking = false;
    const y = window.scrollY;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progressBar = qs('.progress span');
    if (progressBar) progressBar.style.transform = `scaleX(${y / max})`;

    updateReadingText();
    revealTitleMasksOnScroll();

    if (reduceMotion) return;

    const hero = qs('.hero');
    const heroMedia = qs('.hero-media');
    const heroTitle = qs('.hero-title');
    if (hero && heroMedia && heroTitle && y < hero.offsetHeight * 1.15) {
      const progress = clamp(y / hero.offsetHeight);
      heroMedia.style.setProperty('--hero-scale', String(1.035 + progress * 0.075));
      heroMedia.style.setProperty('--hero-y', `${progress * 3.5}%`);
      heroTitle.style.transform = `translate3d(0,${progress * 12}%,0)`;
      heroTitle.style.opacity = String(1 - progress * 0.65);
    }

    parallaxImages.forEach((img) => {
      const revealFrame = img.closest('.anim-image');
      if (revealFrame && !revealFrame.classList.contains('reveal-complete')) return;
      const frame = img.closest('figure,.project-media');
      if (!frame) return;
      const rect = frame.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) return;
      const progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
      img.style.setProperty('--parallax-y', `${(progress - 0.5) * 3}%`);
    });
  };

  const onScroll = () => {
    if (!userHasScrolled && window.scrollY > 2) {
      userHasScrolled = true;
      startImageObserver();
    }
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(renderScroll);
  };

  if (userHasScrolled) startImageObserver();

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', renderScroll);
  window.addEventListener('load', () => {
    if (window.scrollY > 4) {
      userHasScrolled = true;
      startImageObserver();
    }
    renderScroll();
  });
  renderScroll();
})();
