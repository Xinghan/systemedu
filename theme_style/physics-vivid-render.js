/* Physics Vivid — renderer with style picker */
(() => {
  const root = document.getElementById('physVividRoot');
  if (!root || !window.PHYS_VIVID) return;
  const { subs, styles } = window.PHYS_VIVID;

  const renderCard = (sub, styleKey) => {
    const d = styles[styleKey].data[sub.id];
    if (!d) return '';
    return `
      <article class="pv-card pv-${styleKey}" style="--ph:${sub.hue};--phs:${sub.hueSoft}">
        <div class="pv-card-head">
          <div class="pv-code">${sub.code}</div>
          <div>
            <h4>${sub.title}</h4>
            <div class="pv-chinese">${sub.chinese}</div>
          </div>
          <div class="pv-hue-dot" style="background:${sub.hue}"></div>
        </div>
        <p class="pv-tag">${sub.tagline}</p>
        <div class="pv-formula">${sub.formula}</div>
        <div class="pv-label">ICONS</div>
        <div class="pv-icons">${d.icons.map(s=>`<div class="pv-icon">${s}</div>`).join('')}</div>
        <div class="pv-label">KEY OBJECTS</div>
        <div class="pv-objects">${d.objects.map(o=>`<div class="pv-object"><div class="pv-object-svg">${o.svg}</div><div class="pv-object-name">${o.name}</div></div>`).join('')}</div>
      </article>
    `;
  };

  const descMap = {
    tech: 'CAD blueprint · precise · professional engineering documentation',
    dark: 'Dark editorial · refined near-black with single hue accent',
    holo: 'Glass holographic HUD · sci-fi lab · layered depth with glow',
  };
  const letterMap = { tech:'A', dark:'B', holo:'C' };

  const render = (styleKey) => {
    root.innerHTML = `
      <header class="pv-hero">
        <div class="eyebrow">VIVID EXPLORATION · PHYSICS · 物理学</div>
        <h2>Two visual treatments — pick a direction.</h2>
        <p class="pv-sub">Same 7 sub-disciplines, two distinct visual systems: a precise engineering-blueprint look, and an advanced sci-fi hologram interface. Switch between them to compare.</p>
        <div class="pv-picker" role="tablist">
          ${Object.entries(styles).map(([k,s])=>`
            <button class="pv-pick ${k===styleKey?'is-active':''}" data-style="${k}" role="tab">
              <div class="pv-pick-letter">${letterMap[k]}</div>
              <div class="pv-pick-name">${s.name}</div>
              <div class="pv-pick-desc">${descMap[k]}</div>
            </button>
          `).join('')}
        </div>
      </header>
      <div class="pv-grid pv-grid-${styleKey}">
        ${subs.map(s=>renderCard(s, styleKey)).join('')}
      </div>
    `;
    root.querySelectorAll('.pv-pick').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const k = btn.dataset.style;
        localStorage.setItem('physVividStyle', k);
        render(k);
      });
    });
  };

  const saved = localStorage.getItem('physVividStyle') || 'tech';
  render(saved in styles ? saved : 'tech');
})();
