(() => {
  const get = (id) => document.getElementById(id);

  function injectStyles() {
    if (get("fsBtnStyle")) return;
    const style = document.createElement("style");
    style.id = "fsBtnStyle";
    style.textContent = `
      #fsBtn {
        position: fixed;
        top: 14px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2147483647;

        display: inline-flex;
        align-items: center;
        gap: 10px;

        padding: 10px 14px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.25);

        color: #fff;
        font-weight: 800;
        letter-spacing: .08em;
        text-transform: uppercase;

        background: linear-gradient(135deg, #F97316, #FB923C);
        box-shadow:
          0 10px 30px rgba(249,115,22,.28),
          0 0 0 6px rgba(249,115,22,.12);

        cursor: pointer;
        user-select: none;

        transition:
          transform .18s ease,
          box-shadow .18s ease,
          filter .18s ease,
          opacity .18s ease;
      }

      #fsBtn:hover {
        transform: translateX(-50%) translateY(-1px) scale(1.02);
        filter: brightness(1.05);
        box-shadow:
          0 14px 40px rgba(249,115,22,.34),
          0 0 0 8px rgba(249,115,22,.16);
      }

      #fsBtn:active {
        transform: translateX(-50%) translateY(0px) scale(.98);
        filter: brightness(.98);
      }

      #fsBtn:focus {
        outline: none;
      }

      #fsBtn:focus-visible {
        box-shadow:
          0 14px 40px rgba(249,115,22,.34),
          0 0 0 3px rgba(255,255,255,.9),
          0 0 0 9px rgba(249,115,22,.20);
      }

      #fsBtn .fsIcon {
        font-size: 16px;
        line-height: 1;
      }

      #fsBtn .fsText {
        font-size: 11px;
      }

      #fsBtn.fs-nudge {
        animation: fsNudge 1.6s ease-in-out infinite;
      }

      @keyframes fsNudge {
        0%, 100% { transform: translateX(-50%) translateY(0); }
        50%      { transform: translateX(-50%) translateY(-4px); }
      }

      @media (prefers-reduced-motion: reduce) {
        #fsBtn.fs-nudge { animation: none !important; }
        #fsBtn { transition: none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  // extra mobile-friendly CSS + fallback "simulated fullscreen" class
  function injectExtraStyles() {
    if (get("fsBtnExtra")) return;
    const extraCss = `
      /* pastikan sentuhan diterima dan highlight hilang */
      #fsBtn {
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        -webkit-user-select: none;
        user-select: none;
        pointer-events: auto;
      }

      /* kelas fallback: "simulasi fullscreen" untuk browser tanpa Fullscreen API */
      .fs-simulate {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        touch-action: none !important;
      }
    `;
    const extraStyle = document.createElement('style');
    extraStyle.id = 'fsBtnExtra';
    extraStyle.textContent = extraCss;
    document.head.appendChild(extraStyle);
  }

  function renderBtn(btn, isFs) {
    btn.innerHTML = isFs
      ? `
        <i class="ph-bold ph-arrows-in fsIcon"></i>
        <span class="fsText">Keluar Full Screen</span>
      `
      : `
        <i class="ph-bold ph-arrows-out fsIcon"></i>
        <span class="fsText">Full Screen</span>
      `;
  }

  // cross-browser helpers for fullscreen
  function requestFullscreenEl(el) {
    if (!el) return Promise.reject(new Error("No element"));
    if (el.requestFullscreen) return el.requestFullscreen();
    if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
    if (el.msRequestFullscreen) return el.msRequestFullscreen();
    if (el.mozRequestFullScreen) return el.mozRequestFullScreen();
    return Promise.reject(new Error("Fullscreen API not supported"));
  }
  function exitFullscreenDoc() {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    if (document.msExitFullscreen) return document.msExitFullscreen();
    if (document.mozCancelFullScreen) return document.mozCancelFullScreen();
    return Promise.reject(new Error("Exit Fullscreen API not supported"));
  }

  // toggle with fallback
  async function toggleFullScreenWithFallback() {
    const docEl = document.documentElement;
    const isSimulated = docEl.classList.contains('fs-simulate');
    const isNativeFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || document.mozFullScreenElement);

    // Prefer native Fullscreen API if available
    if (!isNativeFs && !isSimulated) {
      try {
        await requestFullscreenEl(docEl);
        return;
      } catch (err) {
        // jatuhkan ke fallback
        // console.warn('requestFullscreen failed, apply fallback', err);
      }
    } else if (isNativeFs) {
      try {
        await exitFullscreenDoc();
        return;
      } catch (err) {
        // console.warn('exitFullscreen failed, try fallback remove class', err);
      }
    }

    // fallback: simulate fullscreen by adding a class
    if (!isSimulated) {
      docEl.classList.add('fs-simulate');
      document.body.style.overflow = 'hidden';
    } else {
      docEl.classList.remove('fs-simulate');
      document.body.style.overflow = '';
    }
  }

  // protect from touch->click double fire
  let lastTouchTs = 0;
  const TOUCH_CLICK_THRESHOLD = 700; // ms

  function ensureBtn() {
    injectStyles();
    injectExtraStyles();

    if (get("fsBtn")) return;

    const btn = document.createElement("button");
    btn.id = "fsBtn";
    btn.type = "button";
    btn.setAttribute("aria-label", "Toggle Full Screen");

    btn.classList.add("fs-nudge");

    const initialFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || document.mozFullScreenElement) || document.documentElement.classList.contains('fs-simulate');
    renderBtn(btn, initialFs);

    // unified handler
    const handler = async (ev) => {
      // If touchstart, prevent default and mark timestamp
      if (ev.type === 'touchstart') {
        lastTouchTs = Date.now();
        ev.preventDefault && ev.preventDefault();
      } else if (ev.type === 'click') {
        // ignore click if it follows a recent touch
        if (Date.now() - lastTouchTs < TOUCH_CLICK_THRESHOLD) return;
      }

      try {
        btn.classList.remove("fs-nudge");
        await toggleFullScreenWithFallback();
      } catch (e) {
        console.error('toggleFullScreen error:', e);
      }
    };

    // add both but with appropriate options
    btn.addEventListener("touchstart", handler, { passive: false });
    btn.addEventListener("click", handler);

    // keep label in sync with fullscreen changes (native or simulated)
    document.addEventListener("fullscreenchange", () => {
      renderBtn(btn, !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || document.mozFullScreenElement) || document.documentElement.classList.contains('fs-simulate'));
    });
    // webkit prefix event (older)
    document.addEventListener("webkitfullscreenchange", () => {
      renderBtn(btn, !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || document.mozFullScreenElement) || document.documentElement.classList.contains('fs-simulate'));
    });

    // observe class changes (for simulated fullscreen)
    const obs = new MutationObserver(() => {
      renderBtn(btn, !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || document.mozFullScreenElement) || document.documentElement.classList.contains('fs-simulate'));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    document.body.appendChild(btn);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureBtn, { once: true });
  } else {
    ensureBtn();
  }
})();
