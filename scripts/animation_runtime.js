/**
 * Animation Runtime -- shared skeleton for all course factory animations.
 *
 * Usage: the LLM provides a CONFIG object and content functions,
 * then calls AnimRuntime.boot() to start.
 *
 * Required globals before boot():
 *   - CONFIG: { title, subtitle, totalFrames, hudLabels, hudValues, guideItems, style }
 *   - getFrameElements(f, W, H): returns element array for frame f
 *   - drawBg(ctx, W, H): draws background (optional, default dark gradient + grid)
 *
 * Optional globals:
 *   - onReady(): called after boot, for additional setup
 *   - customDrawElement(ctx, el): return true if handled, false to fall through to default
 */

var AnimRuntime = (function () {
  'use strict';

  // --- State ---
  var cv, ctx, W = 800, H = 400;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var currentFrame = 0, totalFrames = 4;
  var transitioning = false, playing = false, playTimer = null;
  var LANG = 'cn';
  var I18N = {};

  // --- Palette presets (from animation_game_design/ DESIGN.md + code.html) ---
  var PALETTES = {
    helix_lab: {
      bg: '#0c0e12', bg2: '#111318', surface: '#171a1f',
      primary: '#50ffb0', primaryDim: '#17df93',
      secondary: '#acf900', secondaryDim: '#466800',
      tertiary: '#85ecff', tertiaryDim: '#00d4ee',
      text: '#f6f6fc', muted: '#aaabb0',
      error: '#ff716c', outline: '#74757a',
      glow: 'rgba(80,255,176,0.1)', glowStrong: 'rgba(80,255,176,0.3)',
      glass: 'rgba(23,26,31,0.6)', glassBlur: 20,
      radius: '0px', // helix_lab uses organic curves but 0px for panels
    },
    aether_clinic: {
      bg: '#111318', bg2: '#1a1c20', surface: '#1e2024',
      primary: '#98cbff', primaryDim: '#00a3ff',
      secondary: '#b9f1ff', secondaryDim: '#00e0ff',
      tertiary: '#c6c6c7', tertiaryDim: '#9c9d9d',
      text: '#e2e2e8', muted: '#bec7d4',
      error: '#ffb4ab', outline: '#88919d',
      glow: 'rgba(152,203,255,0.08)', glowStrong: 'rgba(0,163,255,0.15)',
      glass: 'rgba(51,53,57,0.4)', glassBlur: 12,
      radius: '0px',
    },
    ares_mission: {
      bg: '#131313', bg2: '#1c1b1b', surface: '#201f1f',
      primary: '#ffb59c', primaryDim: '#ff7f50',
      secondary: '#c6c6c6', secondaryDim: '#454747',
      tertiary: '#00daf3', tertiaryDim: '#00b4c9',
      text: '#e5e2e1', muted: '#dec0b6',
      error: '#ffb4ab', outline: '#a68b82',
      glow: 'rgba(255,181,156,0.05)', glowStrong: 'rgba(255,127,80,0.15)',
      glass: 'rgba(32,31,31,0.4)', glassBlur: 12,
      radius: '0px',
    },
    celestial_observatory: {
      bg: '#111220', bg2: '#191a29', surface: '#1e1e2d',
      primary: '#c9bfff', primaryDim: '#8771ff',
      secondary: '#ffdb3c', secondaryDim: '#e9c400',
      tertiary: '#c5c6cc', tertiaryDim: '#1c1f24',
      text: '#e2e0f5', muted: '#c8c5cf',
      error: '#ffb4ab', outline: '#918f99',
      glow: 'rgba(30,0,110,0.2)', glowStrong: 'rgba(201,191,255,0.2)',
      glass: 'rgba(51,51,67,0.4)', glassBlur: 20,
      radius: '4px',
    },
    neural_circuit: {
      bg: '#121318', bg2: '#1a1b21', surface: '#1e1f25',
      primary: '#dbfcff', primaryDim: '#00dbe9',
      secondary: '#d7ffc5', secondaryDim: '#2ae500',
      tertiary: '#f8d8ff', tertiaryDim: '#ebb2ff',
      text: '#e3e1e9', muted: '#b9cacb',
      error: '#ffb4ab', outline: '#849495',
      glow: 'rgba(0,219,233,0.08)', glowStrong: 'rgba(0,240,255,0.15)',
      glass: 'rgba(30,31,37,0.4)', glassBlur: 16,
      radius: '0px',
    },
    subatomic_matrix: {
      bg: '#0c0e17', bg2: '#11131d', surface: '#171924',
      primary: '#ff7cf5', primaryDim: '#ff1cfe',
      secondary: '#00fbfb', secondaryDim: '#00ecec',
      tertiary: '#ac89ff', tertiaryDim: '#7000ff',
      text: '#f0f0fd', muted: '#aaaab7',
      error: '#ff6e84', outline: '#737580',
      glow: 'rgba(0,251,251,0.05)', glowStrong: 'rgba(255,124,245,0.15)',
      glass: 'rgba(34,37,50,0.6)', glassBlur: 12,
      radius: '0px',
    },
    rocketry_control: {
      bg: '#05070a', bg2: '#0d111f', surface: '#111425',
      primary: '#ffb000', primaryDim: '#cc8d00',
      secondary: '#ffb08e', secondaryDim: '#ff5f1f',
      tertiary: '#d6d9f3', tertiaryDim: '#bfc2e0',
      text: '#e2e2e9', muted: '#8e90a6',
      error: '#ffb4ab', outline: '#8e90a6',
      glow: 'rgba(255,176,0,0.1)', glowStrong: 'rgba(255,176,0,0.2)',
      glass: 'rgba(17,20,37,0.6)', glassBlur: 12,
      radius: '4px',
    },
    aqua_flow: {
      bg: '#040a0f', bg2: '#081420', surface: '#0c1a2a',
      primary: '#22d3ee', primaryDim: '#06b6d4',
      secondary: '#67e8f9', secondaryDim: '#0891b2',
      tertiary: '#a5f3fc', tertiaryDim: '#155e75',
      text: '#f0fdff', muted: '#80a8b8',
      error: '#ffb4ab', outline: '#6b8090',
      glow: 'rgba(34,211,238,0.1)', glowStrong: 'rgba(34,211,238,0.3)',
      glass: 'rgba(8,20,32,0.6)', glassBlur: 16,
      radius: '0px',
    },
    ember_forge: {
      bg: '#0f0804', bg2: '#1a0c06', surface: '#241408',
      primary: '#f59e0b', primaryDim: '#d97706',
      secondary: '#fcd34d', secondaryDim: '#b45309',
      tertiary: '#fef3c7', tertiaryDim: '#92400e',
      text: '#fffbf0', muted: '#b0a080',
      error: '#ff6e6e', outline: '#8a7560',
      glow: 'rgba(245,158,11,0.1)', glowStrong: 'rgba(245,158,11,0.3)',
      glass: 'rgba(26,12,6,0.6)', glassBlur: 12,
      radius: '0px',
    },
    flora_pulse: {
      bg: '#060e08', bg2: '#0c1a0f', surface: '#122618',
      primary: '#4ade80', primaryDim: '#22c55e',
      secondary: '#86efac', secondaryDim: '#16a34a',
      tertiary: '#bbf7d0', tertiaryDim: '#166534',
      text: '#f0fff4', muted: '#80b090',
      error: '#ff6e6e', outline: '#5a8068',
      glow: 'rgba(74,222,128,0.1)', glowStrong: 'rgba(74,222,128,0.3)',
      glass: 'rgba(12,26,15,0.6)', glassBlur: 16,
      radius: '0px',
    },
  };

  var PAL = PALETTES.helix_lab; // default, overridden by CONFIG.style

  // --- Math helpers ---
  function lerp(a, b, p) { return a + (b - a) * p; }
  function easeInOut(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
  function merge(base, ov) { var r = {}; for (var k in base) r[k] = base[k]; for (var k2 in ov) r[k2] = ov[k2]; return r; }

  // --- i18n ---
  function t(key) { return (I18N[key] && I18N[key][LANG]) || (I18N[key] && I18N[key]['en']) || key; }

  function _buildI18N(cfg) {
    // Merge CONFIG.i18n into I18N
    // Built-in keys (always available)
    I18N = {
      btnPlay:  { en: 'PLAY',  cn: '\u64ad\u653e' },
      btnPause: { en: 'PAUSE', cn: '\u6682\u505c' },
      btnPrev:  { en: 'PREV',  cn: '\u4e0a\u4e00\u5e27' },
      btnNext:  { en: 'NEXT',  cn: '\u4e0b\u4e00\u5e27' },
      guideDefault: { en: 'GUIDE', cn: '\u89c2\u770b\u6307\u5357' },
    };
    if (cfg.i18n) {
      for (var k in cfg.i18n) I18N[k] = cfg.i18n[k];
    }
  }

  // --- Default background ---
  function _defaultDrawBg(c, w, h) {
    var g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, PAL.bg); g.addColorStop(1, PAL.bg2);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // subtle grid
    c.strokeStyle = 'rgba(255,255,255,0.03)'; c.lineWidth = 0.5;
    for (var x = 0; x < w; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (var y = 0; y < h; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  }

  // --- Element drawing ---
  function drawElement(el) {
    if (!el || el.alpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = el.alpha;

    // Allow user override
    if (typeof customDrawElement === 'function' && customDrawElement(ctx, el)) {
      ctx.restore();
      return;
    }

    switch (el.type) {
      case 'label':
        ctx.fillStyle = el.color || PAL.text;
        var isBold = el.bold !== undefined ? el.bold : (el.size >= 14);
        ctx.font = (isBold ? 'bold ' : '') + (el.size || 12) + "px " +
          (isBold ? "'Space Grotesk','Inter','Noto Sans SC'" : "'Inter','Noto Sans SC'") + ",sans-serif";
        ctx.textAlign = el.align || 'center';
        ctx.textBaseline = el.baseline || 'middle';
        if (el.glow) { ctx.shadowColor = el.glow; ctx.shadowBlur = 10; }
        ctx.fillText(el.text, el.x, el.y);
        break;

      case 'text':
        ctx.fillStyle = el.color || PAL.muted;
        ctx.font = (el.size || 11) + "px 'Inter','Noto Sans SC',sans-serif";
        ctx.textAlign = el.align || 'left';
        ctx.textBaseline = el.baseline || 'middle';
        ctx.fillText(el.text, el.x, el.y);
        break;

      case 'box':
        if (el.fill) { ctx.fillStyle = el.fill; ctx.fillRect(el.x, el.y, el.w, el.h); }
        if (el.stroke) { ctx.strokeStyle = el.stroke; ctx.lineWidth = el.lineWidth || 1; ctx.strokeRect(el.x, el.y, el.w, el.h); }
        break;

      case 'circle':
        ctx.beginPath(); ctx.arc(el.x, el.y, el.r || 10, 0, Math.PI * 2);
        if (el.fill) { ctx.fillStyle = el.fill; ctx.fill(); }
        if (el.stroke) { ctx.strokeStyle = el.stroke; ctx.lineWidth = el.lineWidth || 1; ctx.stroke(); }
        if (el.glow) { ctx.shadowColor = el.glow; ctx.shadowBlur = el.glowSize || 12; ctx.fill(); ctx.shadowBlur = 0; }
        break;

      case 'arrow':
        _drawArrow(el.x1, el.y1, el.x2, el.y2, el.color || PAL.primary, el.lineWidth || 1.5, el.headSize || 6);
        break;

      case 'line':
        ctx.strokeStyle = el.color || PAL.muted;
        ctx.lineWidth = el.lineWidth || 1;
        if (el.dash) ctx.setLineDash(el.dash);
        ctx.beginPath(); ctx.moveTo(el.x1, el.y1); ctx.lineTo(el.x2, el.y2); ctx.stroke();
        if (el.dash) ctx.setLineDash([]);
        break;

      case 'gradient_box':
        var gb = ctx.createLinearGradient(el.x, el.y, el.x + el.w, el.y + el.h);
        gb.addColorStop(0, el.color1 || PAL.primary); gb.addColorStop(1, el.color2 || PAL.secondary);
        ctx.fillStyle = gb; ctx.fillRect(el.x, el.y, el.w, el.h);
        if (el.glow) { ctx.shadowColor = el.glow; ctx.shadowBlur = 8; ctx.fillRect(el.x, el.y, el.w, el.h); ctx.shadowBlur = 0; }
        break;

      case 'custom':
        if (typeof el.draw === 'function') el.draw(el.alpha);
        break;

      default:
        if (typeof el.draw === 'function') el.draw(el.alpha);
        break;
    }
    ctx.restore();
  }

  function _drawArrow(x1, y1, x2, y2, color, lw, hs) {
    var angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.strokeStyle = color; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - hs * Math.cos(angle - 0.4), y2 - hs * Math.sin(angle - 0.4));
    ctx.lineTo(x2 - hs * Math.cos(angle + 0.4), y2 - hs * Math.sin(angle + 0.4));
    ctx.fill();
  }

  // --- Frame rendering ---
  function drawFrame(f) {
    var bgFn = (typeof drawBg === 'function') ? drawBg : _defaultDrawBg;
    bgFn(ctx, W, H);
    var elems = getFrameElements(f, W, H);
    elems.forEach(function (el) { drawElement(el); });
  }

  // --- Shared element transition ---
  function transitionTo(nf) {
    if (nf < 0) nf = 0;
    if (nf >= totalFrames) nf = totalFrames - 1;
    if (nf === currentFrame && !transitioning) { drawFrame(currentFrame); _updateHUD(currentFrame); return; }
    if (transitioning) return;

    var oldElems = getFrameElements(currentFrame, W, H);
    var newElems = getFrameElements(nf, W, H);
    var oldMap = {}; oldElems.forEach(function (e) { oldMap[e.id] = e; });
    var newMap = {}; newElems.forEach(function (e) { newMap[e.id] = e; });

    currentFrame = nf;
    _updateHUD(nf);
    transitioning = true;

    var startTime = null, duration = 500;
    var bgFn = (typeof drawBg === 'function') ? drawBg : _defaultDrawBg;

    function step(ts) {
      if (!startTime) startTime = ts;
      var raw = Math.min((ts - startTime) / duration, 1);
      var p = easeInOut(raw);

      bgFn(ctx, W, H);

      // Old-only elements: fade out
      oldElems.forEach(function (oe) {
        if (!newMap[oe.id]) drawElement(merge(oe, { alpha: 1 - p }));
      });

      // New elements
      newElems.forEach(function (ne) {
        var oe = oldMap[ne.id];
        if (oe) {
          // Shared element: lerp position/size
          var merged = merge(ne, {
            x: lerp(oe.x || 0, ne.x || 0, p),
            y: lerp(oe.y || 0, ne.y || 0, p),
            w: lerp(oe.w || 0, ne.w || 0, p),
            h: lerp(oe.h || 0, ne.h || 0, p),
            r: lerp(oe.r || 0, ne.r || 0, p),
            alpha: 1
          });
          // Arrow endpoints
          if (ne.type === 'arrow' && oe.type === 'arrow') {
            merged.x1 = lerp(oe.x1, ne.x1, p); merged.y1 = lerp(oe.y1, ne.y1, p);
            merged.x2 = lerp(oe.x2, ne.x2, p); merged.y2 = lerp(oe.y2, ne.y2, p);
          }
          // Line endpoints
          if (ne.type === 'line' && oe.type === 'line') {
            merged.x1 = lerp(oe.x1, ne.x1, p); merged.y1 = lerp(oe.y1, ne.y1, p);
            merged.x2 = lerp(oe.x2, ne.x2, p); merged.y2 = lerp(oe.y2, ne.y2, p);
          }
          // Text cross-fade
          if ((ne.type === 'label' || ne.type === 'text') && oe.text !== ne.text) {
            drawElement(merge(oe, { alpha: 1 - p }));
            drawElement(merge(ne, { alpha: p }));
          } else {
            drawElement(merged);
          }
        } else {
          // New-only element: fade in
          drawElement(merge(ne, { alpha: p }));
        }
      });

      if (raw < 1) { requestAnimationFrame(step); }
      else { transitioning = false; }
    }
    requestAnimationFrame(step);
  }

  // --- HUD ---
  function _updateHUD(f) {
    var cfg = window.CONFIG || {};
    var labels = cfg.hudLabels || [];
    var values = cfg.hudValues || [];
    for (var i = 0; i < 4; i++) {
      var lEl = document.getElementById('hudL' + (i + 1));
      var vEl = document.getElementById('hudV' + (i + 1));
      if (lEl && labels[i]) lEl.textContent = t(labels[i]);
      if (vEl && values[f] && values[f][i] !== undefined) {
        var val = values[f][i];
        vEl.textContent = (typeof val === 'string' && I18N[val]) ? t(val) : val;
      }
    }
    var fi = document.getElementById('frameIndicator');
    if (fi) fi.textContent = (f + 1) + ' / ' + totalFrames;
  }

  // --- Guide panel ---
  function _buildGuide() {
    var cfg = window.CONFIG || {};
    var guideTitle = document.getElementById('guideTitle');
    var guideContent = document.getElementById('guideContent');
    if (!guideTitle || !guideContent) return;

    guideTitle.textContent = t(cfg.guideTitle || 'guideDefault');
    var items = cfg.guideItems || [];
    var html = '<ul>';
    items.forEach(function (key) { html += '<li>' + t(key) + '</li>'; });
    html += '</ul>';
    guideContent.innerHTML = html;

    // Collapse toggle
    guideTitle.addEventListener('click', function () {
      guideContent.classList.toggle('collapsed');
    });
  }

  // --- refreshI18N ---
  function refreshI18N() {
    var titleEl = document.getElementById('title');
    var subEl = document.getElementById('subtitle');
    if (titleEl) titleEl.textContent = t('title');
    if (subEl) subEl.textContent = t('subtitle');

    var btnPrev = document.getElementById('btnPrev');
    var btnNext = document.getElementById('btnNext');
    var btnPlay = document.getElementById('btnPlay');
    if (btnPrev) btnPrev.textContent = t('btnPrev');
    if (btnNext) btnNext.textContent = t('btnNext');
    if (btnPlay) btnPlay.textContent = playing ? t('btnPause') : t('btnPlay');

    document.getElementById('langBtn').textContent = LANG.toUpperCase();

    _buildGuide();
    _updateHUD(currentFrame);
    drawFrame(currentFrame);
  }

  // --- Resize ---
  function _resize() {
    var wrap = cv.parentElement;
    var rect = wrap.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    W = rect.width; H = rect.height;
    cv.width = W * DPR; cv.height = H * DPR;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawFrame(currentFrame);
  }

  // --- Play / Pause ---
  function _togglePlay() {
    if (playing) {
      playing = false;
      if (playTimer) clearTimeout(playTimer);
      document.getElementById('btnPlay').textContent = t('btnPlay');
      return;
    }
    playing = true;
    document.getElementById('btnPlay').textContent = t('btnPause');
    function autoNext() {
      if (!playing) return;
      if (currentFrame < totalFrames - 1) {
        transitionTo(currentFrame + 1);
        playTimer = setTimeout(autoNext, 1800);
      } else {
        playing = false;
        document.getElementById('btnPlay').textContent = t('btnPlay');
      }
    }
    if (currentFrame >= totalFrames - 1) { currentFrame = -1; }
    autoNext();
  }

  // --- Boot ---
  function boot() {
    var cfg = window.CONFIG || {};
    totalFrames = cfg.totalFrames || 4;

    // Apply palette
    if (cfg.style && PALETTES[cfg.style]) {
      PAL = PALETTES[cfg.style];
    }

    // Inject CSS custom properties from palette
    var root = document.documentElement;
    root.style.setProperty('--bg', PAL.bg);
    root.style.setProperty('--bg2', PAL.bg2);
    root.style.setProperty('--surface', PAL.surface);
    root.style.setProperty('--primary', PAL.primary);
    root.style.setProperty('--primary-dim', PAL.primaryDim);
    root.style.setProperty('--secondary', PAL.secondary);
    root.style.setProperty('--secondary-dim', PAL.secondaryDim);
    root.style.setProperty('--text', PAL.text);
    root.style.setProperty('--muted', PAL.muted);
    root.style.setProperty('--error', PAL.error);
    root.style.setProperty('--outline', PAL.outline);
    root.style.setProperty('--glow', PAL.glow);
    root.style.setProperty('--glow-strong', PAL.glowStrong);
    root.style.setProperty('--glass', PAL.glass);
    root.style.setProperty('--glass-blur', PAL.glassBlur + 'px');
    root.style.setProperty('--radius', PAL.radius);

    // Build i18n table
    _buildI18N(cfg);

    // Canvas init
    cv = document.getElementById('c');
    ctx = cv.getContext('2d');

    // Events
    window.addEventListener('resize', _resize);
    setTimeout(_resize, 200);
    setTimeout(_resize, 600);
    document.fonts.ready.then(function () { _resize(); });

    // Controls
    document.getElementById('langBtn').addEventListener('click', function () {
      LANG = LANG === 'en' ? 'cn' : 'en';
      refreshI18N();
    });

    var btnPrev = document.getElementById('btnPrev');
    var btnNext = document.getElementById('btnNext');
    var btnPlay = document.getElementById('btnPlay');

    if (btnPrev) btnPrev.addEventListener('click', function () {
      if (playing) { playing = false; if (playTimer) clearTimeout(playTimer); }
      transitionTo(currentFrame - 1);
    });
    if (btnNext) btnNext.addEventListener('click', function () {
      if (playing) { playing = false; if (playTimer) clearTimeout(playTimer); }
      transitionTo(currentFrame + 1);
    });
    if (btnPlay) btnPlay.addEventListener('click', _togglePlay);

    // Guide
    _buildGuide();

    // Initial render
    refreshI18N();

    // Callback
    if (typeof onReady === 'function') onReady();
  }

  // --- Public API ---
  return {
    boot: boot,
    // Expose for content scripts
    t: t,
    lerp: lerp,
    easeInOut: easeInOut,
    merge: merge,
    drawElement: drawElement,
    drawFrame: drawFrame,
    transitionTo: transitionTo,
    refreshI18N: refreshI18N,
    get PAL() { return PAL; },
    get W() { return W; },
    get H() { return H; },
    get ctx() { return ctx; },
    get currentFrame() { return currentFrame; },
    get totalFrames() { return totalFrames; },
    get LANG() { return LANG; },
  };
})();
