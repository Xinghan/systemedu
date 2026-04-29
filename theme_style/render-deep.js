/* ========================================================
   Render the "Sub-Disciplines" section of index.html.
   Reads window.DEEP_AREAS and builds one block per parent
   area, with a grid of sub-discipline cards underneath.
======================================================== */
(() => {
  const root = document.getElementById('deepRoot');
  if (!root || !window.DEEP_AREAS) return;

  const renderSubCard = (sub) => `
    <article class="deep-card" style="--dh:${sub.hue}">
      <div class="deep-card-head">
        <div class="deep-num">${sub.code}</div>
        <div class="deep-title">
          <h4>${sub.title}</h4>
          <div class="deep-chinese">${sub.chinese}</div>
        </div>
      </div>
      <p class="deep-tag">${sub.tagline}</p>
      <div class="deep-formula">${sub.formula}</div>

      <div class="deep-section-label">ICONS</div>
      <div class="deep-icons">
        ${sub.icons.map(svg => `<div class="deep-icon">${svg}</div>`).join('')}
      </div>

      <div class="deep-section-label">KEY OBJECTS</div>
      <div class="deep-objects">
        ${sub.objects.map(o => `
          <div class="deep-object">
            <div class="deep-object-svg">${o.svg}</div>
            <div class="deep-object-name">${o.name}</div>
          </div>
        `).join('')}
      </div>
    </article>
  `;

  const renderArea = (area) => `
    <div class="deep-area" id="deep-${area.id}">
      <header class="deep-area-head">
        <div class="deep-parent-code">${area.parent}</div>
        <div>
          <h3>${area.title} <span class="deep-area-chinese">${area.chinese}</span></h3>
          <p>${area.note}</p>
        </div>
        <div class="deep-count">${area.subs.length} sub-disciplines</div>
      </header>
      <div class="deep-grid">
        ${area.subs.map(renderSubCard).join('')}
      </div>
    </div>
  `;

  root.innerHTML = `
    <header class="deep-hero">
      <div class="eyebrow">EXPANSION PACK · SUB-DISCIPLINES · 子学科</div>
      <h2>Every field has depth.</h2>
      <p class="sub">Each parent subject unfolds into specialized branches, each with its own hue, icon set, and signature objects. Use these tokens when a lesson zooms in from "Physics" to "Thermodynamics" — the visual language sharpens with the topic.</p>
      <div class="deep-stats">
        <div><b>${window.DEEP_AREAS.length}</b><span>PARENT AREAS</span></div>
        <div><b>${window.DEEP_AREAS.reduce((n,a)=>n+a.subs.length,0)}</b><span>SUB-DISCIPLINES</span></div>
        <div><b>${window.DEEP_AREAS.reduce((n,a)=>n+a.subs.reduce((m,s)=>m+s.icons.length,0),0)}</b><span>ICONS</span></div>
        <div><b>${window.DEEP_AREAS.reduce((n,a)=>n+a.subs.reduce((m,s)=>m+s.objects.length,0),0)}</b><span>KEY OBJECTS</span></div>
      </div>
    </header>
    ${window.DEEP_AREAS.map(renderArea).join('')}
  `;
})();
