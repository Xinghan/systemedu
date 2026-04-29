/* ========================================================
   Renders all 12 theme sections into <main> and populates nav
======================================================== */

(function render() {
  const main = document.querySelector('main');
  const nav = document.getElementById('subjectNav');

  // nav dots
  nav.innerHTML = THEMES.map(t =>
    `<a href="#${t.id}" data-name="${t.title}" style="--nav-color:${t.nav};background:${t.nav}"></a>`
  ).join('');

  const sections = THEMES.map(t => renderSection(t)).join('');
  main.insertAdjacentHTML('beforeend', sections);
  main.insertAdjacentHTML('beforeend', `
    <footer>
      <div>STEM PBL VISUAL SYSTEM · v1.1 · 26 SUBJECTS · 2026</div>
      <div style="margin-top:12px;opacity:0.6">DESIGNED FOR WONDER / 为好奇而设计</div>
    </footer>
  `);

  // intersection observer for entry animations
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in-view'); });
  }, { threshold: 0.1 });
  document.querySelectorAll('.theme-section').forEach(s => io.observe(s));

  // particle drift — generate per section
  document.querySelectorAll('.particle-stage').forEach(st => {
    for (let i = 0; i < 18; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.top = (30 + Math.random() * 70) + '%';
      p.style.setProperty('--dx', (Math.random() * 80 - 40) + 'px');
      p.style.setProperty('--dy', (-40 - Math.random() * 80) + 'px');
      p.style.animationDelay = (Math.random() * 6) + 's';
      p.style.animationDuration = (4 + Math.random() * 4) + 's';
      st.appendChild(p);
    }
  });
})();

function renderSection(t) {
  const paletteHtml = t.palette.map(p => {
    const lum = parseFloat(p.hex.match(/oklch\(([0-9.]+)/)?.[1] || '0.5');
    const darkClass = lum < 0.6 ? 'dark' : '';
    return `<div class="swatch ${darkClass}" style="background:${p.hex}">${p.name}</div>`;
  }).join('');

  const ICONS_ALL = Object.assign({}, typeof ICONS!=='undefined'?ICONS:{}, typeof ICONS_EXT!=='undefined'?ICONS_EXT:{});
  const PROPS_ALL = Object.assign({}, typeof PROPS!=='undefined'?PROPS:{}, typeof PROPS_EXT!=='undefined'?PROPS_EXT:{});
  const MASCOTS_ALL = Object.assign({}, typeof MASCOTS!=='undefined'?MASCOTS:{}, typeof MASCOTS_EXT!=='undefined'?MASCOTS_EXT:{});
  const ENVS_ALL = Object.assign({}, typeof ENVIRONMENTS!=='undefined'?ENVIRONMENTS:{}, typeof ENVIRONMENTS_EXT!=='undefined'?ENVIRONMENTS_EXT:{});

  const iconsHtml = (ICONS_ALL[t.id] || []).map(svg =>
    `<div class="icon-tile" style="color:${t.accent}">${svg}</div>`
  ).join('');

  const propsHtml = (PROPS_ALL[t.id] || []).map((svg, i) =>
    `<div class="prop" style="color:${t.accent}">${svg}<div class="name">${t.props[i] || ''}</div></div>`
  ).join('');

  return `
  <section class="theme-section" id="${t.id}" style="--accent:${t.accent}">
    <div class="theme-head">
      <div>
        <div class="theme-num">SUBJECT · ${t.num}</div>
        <h2 class="theme-title">${t.title}<span class="code">${t.code}</span></h2>
        <div class="theme-tagline">${t.tagline}</div>
      </div>
      <div></div>
      <div style="text-align:right">
        <div class="theme-label">系列</div>
        <div class="theme-chinese">${t.chinese}</div>
      </div>
    </div>

    <div class="theme-grid">

      <!-- Environment (hero scene) -->
      <div class="panel col-8">
        <div class="p-label"><span>A · ENVIRONMENT</span><span class="tag">SCENE / BACKDROP</span></div>
        <div class="env-scene">${ENVS_ALL[t.id] ? ENVS_ALL[t.id]() : ''}</div>
      </div>

      <!-- Mascot -->
      <div class="panel col-4">
        <div class="p-label"><span>B · MASCOT</span><span class="tag">GUIDE</span></div>
        <div class="mascot-wrap" style="color:${t.accent}">${MASCOTS_ALL[t.id] || ''}</div>
        <p style="font-size:12px;color:var(--fg-dim);line-height:1.5;margin:0">${t.mascot}</p>
      </div>

      <!-- Palette -->
      <div class="panel col-4">
        <div class="p-label"><span>C · PALETTE</span><span class="tag">5 TONES</span></div>
        <div class="palette">${paletteHtml}</div>
      </div>

      <!-- Typography -->
      <div class="panel col-4">
        <div class="p-label"><span>D · TYPE</span><span class="tag">TREATMENT</span></div>
        <div class="type-display">${t.typeDescTitle}</div>
        <div class="type-mono">${t.typeSample}</div>
        <p class="type-body" style="margin-top:10px">Display in Space Grotesk Medium; technical text in JetBrains Mono with the subject hue. Chinese co-set in Noto Sans SC — kept at 90% size to optically match.</p>
      </div>

      <!-- Particle effects -->
      <div class="panel col-4">
        <div class="p-label"><span>E · PARTICLES</span><span class="tag">FX STYLE</span></div>
        <div class="particle-stage"></div>
        <p class="type-body" style="margin-top:12px">Motes drift upward on discovery; gold accent mixed 1-in-4 for reward moments. Radial glow under the stage.</p>
      </div>

      <!-- Icons -->
      <div class="panel col-6">
        <div class="p-label"><span>F · ICON SET</span><span class="tag">6 GLYPHS</span></div>
        <div class="icon-grid">${iconsHtml}</div>
      </div>

      <!-- Props -->
      <div class="panel col-6">
        <div class="p-label"><span>G · KEY PROPS</span><span class="tag">HERO OBJECTS</span></div>
        <div class="props-grid">${propsHtml}</div>
      </div>

      <!-- HUD / Buttons -->
      <div class="panel col-7">
        <div class="p-label"><span>H · HUD · BUTTONS</span><span class="tag">UI KIT</span></div>
        <div class="hud-row">
          <button class="btn primary"><span class="dot"></span>START MISSION</button>
          <button class="btn">HINT</button>
          <button class="btn">SKIP</button>
          <button class="btn"><span class="dot"></span>PAUSED</button>
        </div>
        <div style="margin-top:22px">
          <div class="hud-meta">
            <span>MISSION PROGRESS</span>
            <span>62%</span>
          </div>
          <div class="hud-bar"><div class="fill"></div></div>
        </div>
        <div class="hud-meta" style="margin-top:16px">
          <span>ENERGY · 84</span>
          <span>TIME · 04:12</span>
          <span>XP · 1,240</span>
        </div>
      </div>

      <!-- Loader -->
      <div class="panel col-5">
        <div class="p-label"><span>I · LOADER / TRANSITION</span><span class="tag">ORBITAL</span></div>
        <div class="loader-wrap">
          <div class="loader"><div class="ring"></div><div class="ring"></div><div class="ring"></div><div class="core"></div></div>
          <div class="type-mono">LOADING · ${t.code}</div>
        </div>
      </div>

    </div>
  </section>`;
}
