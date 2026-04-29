/* ========================================================
   Sub-discipline themes — organized by parent area.
   Each entry: id, parent, title, chinese, tagline, hue,
   4 icons, 2 key objects, formula sample.
   All SVG inline; accent colour from --dh hue variable.
======================================================== */

const DEEP_AREAS = [
  /* ================= PHYSICS ================= */
  {
    id: 'phys', title: 'Physics', chinese: '物理', parent: 'PHY',
    note: 'The study of matter, energy, space, and time — from flying footballs to entangled particles.',
    subs: [
      {
        id: 'mech', title: 'Classical Mechanics', chinese: '经典力学', code: 'PHY-M1',
        hue: 'oklch(0.78 0.13 215)',
        tagline: 'Forces, motion, and Newton\'s three laws — the language of everyday movement.',
        formula: 'F = ma · p = mv · E = ½mv²',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="4"/><path d="M12 8V3M12 16v5M8 12H3M16 12h5"/><path d="M12 3l2 2M12 3l-2 2" stroke-linecap="round"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 20 Q8 5 21 8"/><circle cx="21" cy="8" r="2" fill="currentColor"/><circle cx="3" cy="20" r="1.5" fill="currentColor"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3v4M12 3L8 6M12 3l4 3"/><rect x="6" y="14" width="12" height="6"/><circle cx="9" cy="20" r="1.5"/><circle cx="15" cy="20" r="1.5"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 18L12 4l8 14"/><path d="M8 18h8" stroke-dasharray="2 2"/><circle cx="12" cy="4" r="1.5" fill="currentColor"/></svg>',
        ],
        objects: [
          {name:'PENDULUM', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="10" y1="10" x2="90" y2="10"/><line x1="50" y1="10" x2="75" y2="80"/><circle cx="75" cy="80" r="10" fill="oklch(0.28 0.06 215 / 0.5)" stroke="currentColor"/><path d="M50 10 l 0 90" stroke-dasharray="2 3" opacity="0.4"/><path d="M75 80 Q 50 90 25 80" stroke-dasharray="2 2" opacity="0.5"/></svg>'},
          {name:'INCLINE', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 80 L80 80 L80 20 Z" fill="oklch(0.28 0.06 215 / 0.4)"/><rect x="45" y="38" width="14" height="14" transform="rotate(41 52 45)" fill="oklch(0.85 0.14 85 / 0.7)"/><path d="M52 46 L70 70" stroke-dasharray="2 2"/><text x="10" y="95" font-family="JetBrains Mono" font-size="9" fill="currentColor">θ = 41°</text></svg>'},
        ],
      },
      {
        id: 'em', title: 'Electromagnetism', chinese: '电磁学', code: 'PHY-M2',
        hue: 'oklch(0.72 0.17 275)',
        tagline: 'The unified field where electricity and magnetism dance — Maxwell\'s symphony.',
        formula: '∇×B = μ₀J + μ₀ε₀ ∂E/∂t',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2L5 14h6l-2 8 8-12h-6z" fill="currentColor" opacity="0.6"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="6" width="16" height="12" rx="1"/><path d="M4 10h4M4 14h4M16 10h4M16 14h4M10 6v12M14 6v12"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12 Q6 4 12 12 T21 12"/><path d="M3 12 Q6 20 12 12 T21 12" opacity="0.5"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="10"/><path d="M22 12L18 12M2 12L6 12" stroke-dasharray="1 2"/></svg>',
        ],
        objects: [
          {name:'SOLENOID', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="10" y="35" width="80" height="30" fill="oklch(0.28 0.08 275 / 0.4)"/><g>' + Array.from({length:10},(_,i)=>`<ellipse cx="${15+i*8}" cy="50" rx="4" ry="15" stroke="currentColor"/>`).join('') + '</g><path d="M5 50 L10 50 M90 50 L95 50" stroke-width="2"/><path d="M10 22 Q50 16 90 22" fill="none" stroke="oklch(0.85 0.14 85)" stroke-dasharray="2 2"/><path d="M50 22L48 18M50 22L52 18" stroke="oklch(0.85 0.14 85)"/></svg>'},
          {name:'CAPACITOR', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><line x1="10" y1="50" x2="42" y2="50"/><line x1="42" y1="20" x2="42" y2="80"/><line x1="58" y1="20" x2="58" y2="80"/><line x1="58" y1="50" x2="90" y2="50"/><text x="20" y="40" font-family="JetBrains Mono" font-size="9" fill="currentColor" stroke="none">+</text><text x="74" y="40" font-family="JetBrains Mono" font-size="9" fill="currentColor" stroke="none">−</text><g stroke="oklch(0.85 0.14 85)" stroke-width="1"><line x1="45" y1="35" x2="55" y2="35"/><line x1="45" y1="45" x2="55" y2="45"/><line x1="45" y1="55" x2="55" y2="55"/><line x1="45" y1="65" x2="55" y2="65"/></g></svg>'},
        ],
      },
      {
        id: 'opt', title: 'Optics', chinese: '光学', code: 'PHY-M3',
        hue: 'oklch(0.82 0.14 85)',
        tagline: 'Light refracted, reflected, diffracted — geometry made visible.',
        formula: '1/f = 1/u + 1/v · n₁sinθ₁ = n₂sinθ₂',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 12 L12 4 L20 12 L12 20 Z"/><path d="M4 12 L20 12" opacity="0.4"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="12" rx="10" ry="5"/><path d="M2 12h20" opacity="0.4"/><path d="M7 7L17 17M17 7L7 17" opacity="0.3"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6L12 10L3 14"/><path d="M12 10L21 6M12 10L21 10M12 10L21 14" opacity="0.7"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 18 Q6 2 12 18 T22 18"/><path d="M2 20 Q6 4 12 20 T22 20" opacity="0.5"/></svg>',
        ],
        objects: [
          {name:'PRISM', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M50 15 L85 75 L15 75 Z" fill="oklch(0.28 0.06 260 / 0.3)" stroke="currentColor"/><path d="M5 45 L35 55" stroke="oklch(0.92 0.10 60)" stroke-width="2"/><g stroke-width="2"><path d="M65 55 L95 40" stroke="oklch(0.72 0.20 20)"/><path d="M65 55 L95 48" stroke="oklch(0.82 0.18 60)"/><path d="M65 55 L95 56" stroke="oklch(0.85 0.18 110)"/><path d="M65 55 L95 64" stroke="oklch(0.72 0.18 220)"/><path d="M65 55 L95 72" stroke="oklch(0.72 0.18 285)"/></g></svg>'},
          {name:'LENS', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M50 15 Q30 50 50 85 Q70 50 50 15 Z" fill="oklch(0.82 0.14 85 / 0.2)" stroke="currentColor"/><line x1="0" y1="50" x2="40" y2="50" stroke="oklch(0.85 0.14 85)" stroke-width="1"/><line x1="60" y1="50" x2="100" y2="50" stroke="oklch(0.85 0.14 85)" stroke-width="1"/><circle cx="82" cy="50" r="2" fill="oklch(0.85 0.14 85)"/><text x="20" y="42" font-family="JetBrains Mono" font-size="9" fill="currentColor">f = 32mm</text></svg>'},
        ],
      },
      {
        id: 'thermo', title: 'Thermodynamics', chinese: '热力学', code: 'PHY-M4',
        hue: 'oklch(0.75 0.17 25)',
        tagline: 'Heat, work, and the arrow of time — entropy never runs backward.',
        formula: 'dS ≥ dQ/T · PV = nRT',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="10" y="3" width="4" height="14" rx="2"/><circle cx="12" cy="19" r="3" fill="currentColor"/><path d="M12 6v10"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 20 Q8 14 12 10 Q16 6 12 2 Q12 8 8 12 Q4 16 8 20Z" fill="currentColor" opacity="0.3"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6" cy="18" r="1.5" fill="currentColor"/><circle cx="18" cy="18" r="1.5" fill="currentColor"/><circle cx="10" cy="10" r="1.5" fill="currentColor"/><circle cx="16" cy="8" r="1.5" fill="currentColor"/><circle cx="12" cy="15" r="1.5" fill="currentColor"/><path d="M6 18L10 10M18 18L16 8M10 10L16 8M12 15L10 10M12 15L18 18" opacity="0.4"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="10" width="16" height="8" rx="1"/><path d="M8 10V4M12 10V6M16 10V4" stroke-width="1"/><rect x="9" y="13" width="2" height="3" fill="currentColor"/><rect x="13" y="12" width="2" height="4" fill="currentColor"/></svg>',
        ],
        objects: [
          {name:'CARNOT CYCLE', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 30 Q45 20 75 30 L80 55 Q50 70 25 55 Z" fill="oklch(0.28 0.08 25 / 0.3)"/><text x="20" y="18" font-family="JetBrains Mono" font-size="8" fill="currentColor">P</text><text x="82" y="85" font-family="JetBrains Mono" font-size="8" fill="currentColor">V</text><path d="M10 85 L90 85 M10 10 L10 90" stroke-width="1"/><text x="45" y="48" font-family="JetBrains Mono" font-size="8" fill="oklch(0.85 0.14 85)" stroke="none">η = 1-Tc/Th</text></svg>'},
          {name:'PISTON', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="20" y="20" width="60" height="55" fill="oklch(0.28 0.08 25 / 0.4)"/><rect x="20" y="35" width="60" height="10" fill="oklch(0.85 0.14 85 / 0.7)"/><line x1="50" y1="10" x2="50" y2="35" stroke-width="3"/><circle cx="50" cy="8" r="4" fill="currentColor"/><g opacity="0.5">' + Array.from({length:12},()=>{const x=25+Math.random()*50;const y=50+Math.random()*20;return `<circle cx="${x}" cy="${y}" r="1.3" fill="currentColor"/>`}).join('') + '</g><path d="M50 80 L50 90" stroke="oklch(0.85 0.14 85)"/></svg>'},
        ],
      },
      {
        id: 'rel', title: 'Relativity', chinese: '相对论', code: 'PHY-M5',
        hue: 'oklch(0.72 0.17 295)',
        tagline: 'Spacetime bends around mass. Clocks slow near the speed of light.',
        formula: 'E = mc² · ds² = −c²dt² + dx²',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3" fill="currentColor"/><ellipse cx="12" cy="12" rx="10" ry="5"/><ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-60 12 12)"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 21 Q6 18 12 18 T21 21 M3 18 Q6 14 12 14 T21 18 M3 14 Q6 9 12 9 T21 14" opacity="0.7"/><circle cx="12" cy="11" r="2" fill="currentColor"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18" opacity="0.3"/><path d="M3 3l18 18M21 3L3 21" opacity="0.5"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12L22 12" stroke-dasharray="2 2"/><circle cx="7" cy="12" r="2" fill="currentColor"/><circle cx="17" cy="12" r="2" fill="currentColor"/><path d="M9 12L15 12" stroke="oklch(0.85 0.14 85)"/><text x="9" y="9" font-family="JetBrains Mono" font-size="6" fill="currentColor" stroke="none">v→c</text></svg>',
        ],
        objects: [
          {name:'LIGHT CONE', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="10" y1="50" x2="90" y2="50" stroke-dasharray="2 3"/><line x1="50" y1="5" x2="50" y2="95" stroke-dasharray="2 3"/><path d="M50 50 L20 15 L80 15 Z" fill="oklch(0.85 0.14 85 / 0.2)" stroke="oklch(0.85 0.14 85)"/><path d="M50 50 L20 85 L80 85 Z" fill="oklch(0.72 0.17 295 / 0.2)" stroke="currentColor"/><circle cx="50" cy="50" r="3" fill="currentColor"/><text x="55" y="10" font-family="JetBrains Mono" font-size="8" fill="oklch(0.85 0.14 85)">FUTURE</text><text x="55" y="98" font-family="JetBrains Mono" font-size="8" fill="currentColor">PAST</text></svg>'},
          {name:'SPACETIME WELL', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1"><g stroke="oklch(0.72 0.17 295 / 0.8)">' + Array.from({length:8},(_,i)=>{const y=15+i*10;const dip=15-Math.abs(i-4)*3;return `<path d="M5 ${y} Q 30 ${y} 50 ${y+dip} Q 70 ${y} 95 ${y}"/>`}).join('') + '<path d="M50 50 Q50 70 50 90" stroke-width="0.5" stroke-dasharray="1 2"/></g><circle cx="50" cy="68" r="6" fill="oklch(0.85 0.14 85)"/></svg>'},
        ],
      },
      {
        id: 'qm', title: 'Quantum Mechanics', chinese: '量子力学', code: 'PHY-M6',
        hue: 'oklch(0.72 0.17 310)',
        tagline: 'Particles that are waves, cats that are both alive and dead — welcome to the small.',
        formula: 'iℏ ∂ψ/∂t = Ĥψ · ΔxΔp ≥ ℏ/2',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12 Q6 4 9 12 T15 12 T21 12" /><path d="M3 16 Q6 8 9 16 T15 16 T21 16" opacity="0.5"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="12" r="2" fill="currentColor"/><circle cx="17" cy="12" r="2" fill="currentColor"/><path d="M9 12 Q12 5 15 12" stroke-dasharray="2 2"/><path d="M9 12 Q12 19 15 12" stroke-dasharray="2 2"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="4" width="14" height="16"/><path d="M5 8h14M5 12h14M5 16h14" opacity="0.3"/><text x="12" y="14" text-anchor="middle" font-family="JetBrains Mono" font-size="8" fill="currentColor" stroke="none">|ψ⟩</text></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 3 A 9 9 0 0 1 20 17" stroke="oklch(0.85 0.14 85)"/><circle cx="12" cy="12" r="2" fill="currentColor"/><text x="4" y="22" font-family="JetBrains Mono" font-size="6" fill="currentColor" stroke="none">BLOCH</text></svg>',
        ],
        objects: [
          {name:'DOUBLE SLIT', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="35" y="10" width="4" height="80" fill="oklch(0.28 0.08 310 / 0.5)"/><rect x="35" y="35" width="4" height="8" fill="oklch(0.15 0.04 265)"/><rect x="35" y="57" width="4" height="8" fill="oklch(0.15 0.04 265)"/><rect x="80" y="10" width="3" height="80" fill="oklch(0.28 0.08 310 / 0.6)"/>' + Array.from({length:9},(_,i)=>`<rect x="83" y="${13+i*9}" width="6" height="4" fill="oklch(0.72 0.17 310)" opacity="${0.3+0.7*Math.abs(Math.sin(i*0.8))}"/>`).join('') + '<g stroke="oklch(0.85 0.14 85)" stroke-width="0.7" fill="none">' + Array.from({length:6},(_,i)=>`<path d="M 20 ${50+(i-3)*3} Q 40 ${50+(i-3)*3} 80 ${50+(i-3)*8}"/>`).join('') + '</g><circle cx="15" cy="50" r="3" fill="oklch(0.85 0.14 85)"/></svg>'},
          {name:'QUBIT STATE', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1"><circle cx="50" cy="50" r="35" stroke="currentColor"/><ellipse cx="50" cy="50" rx="35" ry="12" stroke="currentColor" stroke-dasharray="2 2"/><line x1="50" y1="15" x2="50" y2="85" stroke-dasharray="2 3"/><line x1="15" y1="50" x2="85" y2="50" stroke-dasharray="2 3"/><line x1="50" y1="50" x2="72" y2="28" stroke="oklch(0.85 0.14 85)" stroke-width="2"/><circle cx="72" cy="28" r="3" fill="oklch(0.85 0.14 85)"/><text x="15" y="12" font-family="JetBrains Mono" font-size="8" fill="currentColor">|0⟩</text><text x="15" y="98" font-family="JetBrains Mono" font-size="8" fill="currentColor">|1⟩</text></svg>'},
        ],
      },
      {
        id: 'aco', title: 'Acoustics', chinese: '声学', code: 'PHY-M7',
        hue: 'oklch(0.78 0.12 190)',
        tagline: 'Pressure waves through air, water, and solids — music and sonar both live here.',
        formula: 'v = fλ · I = P/4πr²',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12h4l4-4v8L7 12"/><path d="M14 8 Q17 12 14 16M17 5 Q22 12 17 19" opacity="0.7"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12 Q6 4 10 12 T18 12 T22 12"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="8" width="2" height="8"/><rect x="10" y="5" width="2" height="14"/><rect x="14" y="9" width="2" height="6"/><rect x="18" y="7" width="2" height="10"/><rect x="2" y="10" width="2" height="4"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3" fill="currentColor"/><circle cx="12" cy="12" r="6" opacity="0.5"/><circle cx="12" cy="12" r="9" opacity="0.3"/></svg>',
        ],
        objects: [
          {name:'OSCILLOSCOPE', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="10" y="15" width="80" height="55" rx="3" fill="oklch(0.15 0.04 190)"/><path d="M15 43 Q25 20 35 43 T55 43 T75 43 T85 43" stroke="oklch(0.82 0.15 190)" stroke-width="1.5" fill="none"/><g opacity="0.3">' + Array.from({length:5},(_,i)=>`<line x1="15" y1="${20+i*10}" x2="85" y2="${20+i*10}" stroke="oklch(0.82 0.15 190)" stroke-width="0.5"/>`).join('') + '</g><circle cx="25" cy="85" r="6" fill="oklch(0.28 0.06 190)" stroke="currentColor"/><circle cx="75" cy="85" r="6" fill="oklch(0.28 0.06 190)" stroke="currentColor"/><text x="40" y="88" font-family="JetBrains Mono" font-size="7" fill="currentColor">440Hz</text></svg>'},
          {name:'SPEAKER', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="15" y="15" width="45" height="70" rx="3" fill="oklch(0.28 0.06 190 / 0.5)"/><circle cx="37.5" cy="35" r="10"/><circle cx="37.5" cy="35" r="5" fill="currentColor"/><circle cx="37.5" cy="65" r="15"/><circle cx="37.5" cy="65" r="8" fill="currentColor"/><g stroke="oklch(0.85 0.14 85)" fill="none">' + [1,2,3].map(i=>`<path d="M 68 ${50-i*4} Q ${72+i*4} 50 68 ${50+i*4}"/>`).join('') + '</g></svg>'},
        ],
      },
    ],
  },

  /* ================= CHEMISTRY ================= */
  {
    id: 'chem', title: 'Chemistry', chinese: '化学', parent: 'CHE',
    note: 'The science of substances, their structure, and their transformations.',
    subs: [
      {
        id: 'org', title: 'Organic Chemistry', chinese: '有机化学', code: 'CHE-M1',
        hue: 'oklch(0.82 0.17 125)',
        tagline: 'Carbon chains and rings — the scaffolding of every living thing.',
        formula: 'C₆H₁₂O₆ · CH₃-(CH₂)ₙ-COOH',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L22 8L22 16L12 22L2 16L2 8Z"/><path d="M12 2L12 8M12 16L12 22M2 8L12 8L22 8M2 16L12 16L22 16" opacity="0.4"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 12h3M14 12h3M12 8v2M12 14v2"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 18L8 10L13 18M8 10L13 2L18 10L13 18L18 18"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3" fill="currentColor"/><circle cx="12" cy="4" r="2"/><circle cx="20" cy="12" r="2"/><circle cx="12" cy="20" r="2"/><circle cx="4" cy="12" r="2"/><path d="M12 7v2M17 12h-2M12 17v-2M7 12h2"/></svg>',
        ],
        objects: [
          {name:'BENZENE RING', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M50 15 L80 33 L80 67 L50 85 L20 67 L20 33 Z"/><circle cx="50" cy="40" r="18" stroke-dasharray="3 3"/>' + [[50,15],[80,33],[80,67],[50,85],[20,67],[20,33]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="3" fill="oklch(0.28 0.08 125)"/><text x="${x-3}" y="${y+3}" font-family="JetBrains Mono" font-size="7" fill="currentColor" stroke="none">C</text>`).join('') + '</svg>'},
          {name:'AMINO ACID', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="25" cy="50" r="10" fill="oklch(0.28 0.08 125 / 0.6)"/><text x="18" y="54" font-family="JetBrains Mono" font-size="9" fill="currentColor" stroke="none">NH₂</text><line x1="35" y1="50" x2="50" y2="50"/><circle cx="55" cy="50" r="6" fill="oklch(0.82 0.17 125 / 0.5)"/><text x="51" y="53" font-family="JetBrains Mono" font-size="7" fill="currentColor" stroke="none">Cα</text><line x1="55" y1="44" x2="55" y2="30"/><circle cx="55" cy="24" r="5"/><text x="52" y="26" font-family="JetBrains Mono" font-size="6" fill="currentColor" stroke="none">R</text><line x1="61" y1="50" x2="76" y2="50"/><circle cx="81" cy="50" r="9" fill="oklch(0.85 0.14 85 / 0.5)"/><text x="74" y="53" font-family="JetBrains Mono" font-size="8" fill="currentColor" stroke="none">COOH</text></svg>'},
        ],
      },
      {
        id: 'inorg', title: 'Inorganic Chemistry', chinese: '无机化学', code: 'CHE-M2',
        hue: 'oklch(0.78 0.12 190)',
        tagline: 'Metals, salts, and everything without a carbon backbone.',
        formula: 'FeCl₃ · CuSO₄·5H₂O',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="3" width="12" height="18" rx="1"/><text x="12" y="12" text-anchor="middle" font-family="Space Grotesk" font-weight="600" font-size="7" fill="currentColor" stroke="none">Fe</text><text x="12" y="18" text-anchor="middle" font-family="JetBrains Mono" font-size="5" fill="currentColor" stroke="none">26</text></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L16 8L22 10L17 15L18 22L12 19L6 22L7 15L2 10L8 8Z"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="4" cy="12" r="2"/><circle cx="20" cy="12" r="2"/><circle cx="12" cy="4" r="2"/><circle cx="12" cy="20" r="2"/><path d="M6 12h4M14 12h4M12 6v4M12 14v4"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3L3 9v6l9 6 9-6V9z"/><path d="M12 3v18M3 9l18 6M21 9L3 15" opacity="0.3"/></svg>',
        ],
        objects: [
          {name:'CRYSTAL STRUCTURE', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1"><g transform="translate(50 55)"><path d="M-25 -25 L25 -25 L35 -10 L35 30 L-15 30 L-35 10 L-25 -25 Z M-25 -25 L-15 30 M25 -25 L35 -10 M35 30 L-15 30" stroke="currentColor"/><g fill="oklch(0.78 0.12 190)">' + [[-25,-25],[25,-25],[35,-10],[35,30],[-15,30],[-35,10]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="4"/>`).join('') + '<circle cx="0" cy="0" r="4" fill="oklch(0.85 0.14 85)"/></g><g stroke="currentColor" stroke-dasharray="1 2">' + [[-25,-25],[25,-25],[35,-10],[35,30],[-15,30],[-35,10]].map(([x,y])=>`<line x1="0" y1="0" x2="${x}" y2="${y}"/>`).join('') + '</g></g></svg>'},
          {name:'SALT LATTICE', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1"><g>' + (()=>{let s='';for(let i=0;i<4;i++)for(let j=0;j<4;j++){const x=15+i*22;const y=15+j*22;const isNa=(i+j)%2===0;s+=`<circle cx="${x}" cy="${y}" r="${isNa?5:7}" fill="${isNa?'oklch(0.82 0.14 85)':'oklch(0.72 0.14 190)'}" opacity="0.8"/>`;s+=`<text x="${x-3}" y="${y+3}" font-family="JetBrains Mono" font-size="6" fill="oklch(0.15 0.04 265)" stroke="none">${isNa?'Na':'Cl'}</text>`;}return s;})() + '</g><g stroke="currentColor" stroke-dasharray="1 2" opacity="0.5">' + (()=>{let s='';for(let i=0;i<4;i++){s+=`<line x1="15" y1="${15+i*22}" x2="81" y2="${15+i*22}"/>`;s+=`<line x1="${15+i*22}" y1="15" x2="${15+i*22}" y2="81"/>`;}return s;})() + '</g></svg>'},
        ],
      },
      {
        id: 'ana', title: 'Analytical Chemistry', chinese: '分析化学', code: 'CHE-M3',
        hue: 'oklch(0.75 0.17 25)',
        tagline: 'What is this made of, and how much? Instruments decipher the answer.',
        formula: 'A = εcl · pH = -log[H⁺]',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 3h12l-4 8v9a1 1 0 01-1 1h-2a1 1 0 01-1-1v-9z"/><path d="M9 11h6" opacity="0.5"/><circle cx="12" cy="15" r="0.8" fill="currentColor"/><circle cx="11" cy="17" r="0.8" fill="currentColor"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 18 L6 12 L9 15 L14 6 L17 10 L21 4"/><path d="M3 22h18" opacity="0.5"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="6" width="16" height="12" rx="1"/><rect x="7" y="9" width="10" height="6"/><circle cx="17" cy="4" r="1.5" fill="currentColor"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="4" width="14" height="16" rx="1"/><rect x="7" y="6" width="3" height="12" fill="oklch(0.72 0.17 20)"/><rect x="11" y="6" width="3" height="12" fill="oklch(0.82 0.14 85)"/><rect x="15" y="6" width="3" height="12" fill="oklch(0.72 0.17 140)"/></svg>',
        ],
        objects: [
          {name:'pH STRIP', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1"><rect x="10" y="30" width="80" height="20" rx="2" stroke="currentColor"/>' + [[10,'oklch(0.65 0.22 25)','0'],[20,'oklch(0.7 0.20 40)','2'],[30,'oklch(0.75 0.18 80)','4'],[40,'oklch(0.82 0.17 110)','6'],[50,'oklch(0.75 0.17 140)','7'],[60,'oklch(0.72 0.15 180)','8'],[70,'oklch(0.70 0.18 220)','10'],[80,'oklch(0.60 0.20 275)','12']].map(([x,c,v])=>`<rect x="${x}" y="30" width="10" height="20" fill="${c}"/><text x="${x+2}" y="62" font-family="JetBrains Mono" font-size="7" fill="currentColor">${v}</text>`).join('') + '<text x="10" y="25" font-family="JetBrains Mono" font-size="8" fill="oklch(0.85 0.14 85)">pH</text><rect x="48" y="28" width="6" height="24" stroke="oklch(0.85 0.14 85)" stroke-width="2" fill="none"/></svg>'},
          {name:'SPECTRUM', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1"><rect x="10" y="25" width="80" height="30" fill="oklch(0.15 0.04 265)" stroke="currentColor"/>' + Array.from({length:80},(_,i)=>{const peak=Math.exp(-((i-25)**2)/80)+0.6*Math.exp(-((i-55)**2)/40)+0.3*Math.exp(-((i-68)**2)/20);return `<line x1="${10+i}" y1="55" x2="${10+i}" y2="${55-peak*26}" stroke="oklch(0.75 0.17 25)" stroke-width="1"/>`}).join('') + '<line x1="10" y1="55" x2="90" y2="55" stroke="currentColor"/><line x1="10" y1="25" x2="10" y2="55" stroke="currentColor"/><text x="10" y="70" font-family="JetBrains Mono" font-size="7" fill="currentColor">200nm</text><text x="70" y="70" font-family="JetBrains Mono" font-size="7" fill="currentColor">800nm</text></svg>'},
        ],
      },
      {
        id: 'biochem', title: 'Biochemistry', chinese: '生物化学', code: 'CHE-M4',
        hue: 'oklch(0.75 0.17 155)',
        tagline: 'The chemistry of life — enzymes fold, DNA codes, ATP fuels.',
        formula: 'ATP → ADP + Pi + energy',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 3 Q8 12 16 12 Q16 21 8 21 M16 3 Q16 12 8 12 Q8 21 16 21"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="8"/><circle cx="9" cy="10" r="1.5" fill="currentColor"/><path d="M14 15 Q16 13 17 10" stroke="oklch(0.85 0.14 85)"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="10" y="3" width="4" height="6" rx="1"/><path d="M8 9L16 9L18 15L6 15Z"/><rect x="9" y="15" width="6" height="6" rx="1"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12h6M15 12h6"/><circle cx="12" cy="12" r="3"/><path d="M12 3L12 9M12 15L12 21"/><circle cx="12" cy="3" r="1" fill="currentColor"/><circle cx="12" cy="21" r="1" fill="currentColor"/></svg>',
        ],
        objects: [
          {name:'ENZYME', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 40 Q15 15 40 15 Q65 15 65 35 L65 45 L55 45 Q50 45 50 52 Q50 60 58 60 L70 60 Q85 60 85 80 Q85 90 70 90 L30 90 Q15 90 15 75 Z" fill="oklch(0.28 0.08 155 / 0.4)"/><circle cx="58" cy="52" r="5" fill="oklch(0.85 0.14 85)"/><text x="46" y="42" font-family="JetBrains Mono" font-size="7" fill="currentColor" stroke="none">ACTIVE</text></svg>'},
          {name:'ATP', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="8" y="40" width="22" height="20" rx="3" fill="oklch(0.28 0.08 155 / 0.4)"/><text x="12" y="53" font-family="Space Grotesk" font-size="10" fill="currentColor" stroke="none" font-weight="600">ADE</text><circle cx="38" cy="50" r="7" stroke="currentColor"/><text x="34" y="53" font-family="JetBrains Mono" font-size="7" fill="currentColor" stroke="none">R</text><g><circle cx="55" cy="50" r="7" fill="oklch(0.85 0.14 85 / 0.4)"/><text x="53" y="53" font-family="JetBrains Mono" font-size="7" fill="currentColor" stroke="none">P</text></g><g><circle cx="72" cy="50" r="7" fill="oklch(0.85 0.14 85 / 0.6)"/><text x="70" y="53" font-family="JetBrains Mono" font-size="7" fill="currentColor" stroke="none">P</text></g><g><circle cx="89" cy="50" r="7" fill="oklch(0.85 0.14 85 / 0.9)" stroke="oklch(0.85 0.14 85)" stroke-width="2"/><text x="87" y="53" font-family="JetBrains Mono" font-size="7" fill="currentColor" stroke="none">P</text></g><line x1="45" y1="50" x2="48" y2="50"/><line x1="62" y1="50" x2="65" y2="50" stroke="oklch(0.85 0.14 85)" stroke-width="2"/><line x1="79" y1="50" x2="82" y2="50" stroke="oklch(0.85 0.14 85)" stroke-width="2"/></svg>'},
        ],
      },
      {
        id: 'phy-chem', title: 'Physical Chemistry', chinese: '物理化学', code: 'CHE-M5',
        hue: 'oklch(0.72 0.17 275)',
        tagline: 'Why reactions happen, how fast, and how much energy flows.',
        formula: 'ΔG = ΔH - TΔS · k = Ae^(-Ea/RT)',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 18 Q6 18 8 14 Q10 6 14 6 Q18 6 20 10 Q21 14 21 18"/><line x1="3" y1="18" x2="21" y2="18"/><circle cx="13" cy="7" r="1.5" fill="currentColor"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 3L6 17 Q6 21 12 21 Q18 21 18 17 L18 3"/><path d="M6 8h12" opacity="0.3"/><circle cx="10" cy="13" r="0.8" fill="currentColor"/><circle cx="13" cy="15" r="0.8" fill="currentColor"/><circle cx="11" cy="17" r="0.8" fill="currentColor"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 17h4l2-4 4 8 3-12 2 5h3"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 12 Q12 4 20 12 Q12 20 4 12Z" opacity="0.3" fill="currentColor"/><path d="M4 12 Q12 4 20 12 Q12 20 4 12Z"/><path d="M4 12h16" stroke-dasharray="2 2"/></svg>',
        ],
        objects: [
          {name:'REACTION COORDINATE', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="10" y1="85" x2="90" y2="85"/><line x1="10" y1="10" x2="10" y2="85"/><path d="M15 70 Q30 70 40 40 Q50 15 60 40 Q70 70 85 60" stroke="currentColor" stroke-width="2"/><path d="M45 27 L55 27" stroke="oklch(0.85 0.14 85)" stroke-width="1" stroke-dasharray="2 2"/><path d="M50 27 L50 40" stroke="oklch(0.85 0.14 85)" stroke-width="1" stroke-dasharray="2 2"/><text x="52" y="32" font-family="JetBrains Mono" font-size="7" fill="oklch(0.85 0.14 85)">Ea</text><circle cx="50" cy="27" r="3" fill="oklch(0.85 0.14 85)"/><text x="13" y="8" font-family="JetBrains Mono" font-size="7" fill="currentColor">E</text><text x="82" y="97" font-family="JetBrains Mono" font-size="7" fill="currentColor">rxn</text></svg>'},
          {name:'MAXWELL-BOLTZMANN', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="10" y1="85" x2="90" y2="85"/><line x1="10" y1="10" x2="10" y2="85"/><path d="M10 85 Q25 80 35 50 Q45 20 55 40 Q70 70 90 82" stroke="currentColor" stroke-width="2"/><path d="M10 85 Q25 82 40 70 Q55 40 65 55 Q80 78 90 83" stroke="oklch(0.85 0.14 85)" stroke-width="2" opacity="0.8"/><text x="35" y="18" font-family="JetBrains Mono" font-size="7" fill="currentColor">T₁</text><text x="60" y="45" font-family="JetBrains Mono" font-size="7" fill="oklch(0.85 0.14 85)">T₂ > T₁</text><text x="82" y="97" font-family="JetBrains Mono" font-size="7" fill="currentColor">v</text></svg>'},
        ],
      },
      {
        id: 'electro', title: 'Electrochemistry', chinese: '电化学', code: 'CHE-M6',
        hue: 'oklch(0.82 0.17 135)',
        tagline: 'Electrons pushed and pulled through solutions — batteries, corrosion, plating.',
        formula: 'E = E° − (RT/nF)lnQ',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="8" width="14" height="8" rx="1"/><rect x="18" y="10" width="2" height="4" fill="currentColor"/><path d="M8 12h6" opacity="0.5"/><text x="10" y="13" font-family="JetBrains Mono" font-size="6" fill="currentColor" stroke="none">+−</text></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="4"/><path d="M12 4v4M12 16v4M4 12h4M16 12h4M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 6v12M19 6v12"/><path d="M3 10h4M3 14h4M17 10h4M17 14h4"/><path d="M5 12h14" opacity="0.5" stroke-dasharray="1 2"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 3L17 3L17 6L13 18L11 18L7 6Z" fill="oklch(0.28 0.08 135 / 0.4)"/><circle cx="12" cy="10" r="1" fill="currentColor"/><circle cx="10" cy="13" r="1" fill="currentColor"/><circle cx="14" cy="14" r="1" fill="currentColor"/></svg>',
        ],
        objects: [
          {name:'GALVANIC CELL', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="8" y="40" width="30" height="50" fill="oklch(0.28 0.08 135 / 0.3)" stroke="currentColor"/><rect x="62" y="40" width="30" height="50" fill="oklch(0.28 0.08 135 / 0.3)" stroke="currentColor"/><path d="M38 50 Q50 35 62 50" stroke="currentColor"/><rect x="18" y="28" width="3" height="30" fill="currentColor"/><rect x="79" y="28" width="3" height="30" fill="currentColor"/><path d="M19 28 L19 15 L80 15 L80 28" stroke="currentColor"/><circle cx="50" cy="15" r="5" fill="oklch(0.15 0.04 265)" stroke="oklch(0.85 0.14 85)" stroke-width="1.5"/><text x="47" y="18" font-family="JetBrains Mono" font-size="6" fill="oklch(0.85 0.14 85)" stroke="none">V</text><text x="12" y="95" font-family="JetBrains Mono" font-size="7" fill="currentColor">Zn</text><text x="78" y="95" font-family="JetBrains Mono" font-size="7" fill="currentColor">Cu</text><text x="45" y="45" font-family="JetBrains Mono" font-size="6" fill="currentColor" stroke="none">salt</text></svg>'},
          {name:'ELECTROLYSIS', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 35 L15 85 L85 85 L85 35 Q85 30 80 30 L20 30 Q15 30 15 35 Z" fill="oklch(0.28 0.08 135 / 0.4)"/><rect x="28" y="18" width="4" height="50" fill="oklch(0.7 0.05 80)" stroke="currentColor"/><rect x="68" y="18" width="4" height="50" fill="oklch(0.7 0.05 80)" stroke="currentColor"/>' + Array.from({length:10},()=>`<circle cx="${20+Math.random()*60}" cy="${50+Math.random()*25}" r="1.5" fill="oklch(0.85 0.14 85)"/>`).join('') + '<text x="22" y="14" font-family="JetBrains Mono" font-size="8" fill="currentColor">+</text><text x="65" y="14" font-family="JetBrains Mono" font-size="8" fill="currentColor">−</text></svg>'},
        ],
      },
    ],
  },

  /* ================= BIOLOGY ================= */
  {
    id: 'bio', title: 'Biology', chinese: '生物学', parent: 'BIO',
    note: 'Life at every scale — from folded proteins to interconnected ecosystems.',
    subs: [
      {
        id: 'mol', title: 'Molecular Biology', chinese: '分子生物学', code: 'BIO-M1',
        hue: 'oklch(0.75 0.17 155)',
        tagline: 'DNA, RNA, and proteins — how genetic information becomes living machinery.',
        formula: 'DNA → RNA → Protein',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 3 Q12 7 18 3 M6 9 Q12 13 18 9 M6 15 Q12 19 18 15 M6 21 Q12 18 18 21"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 3v18M16 3v18M8 7h8M10 11h4M8 15h8M10 19h4" opacity="0.5"/><rect x="7" y="4" width="2" height="2"/><rect x="15" y="8" width="2" height="2"/><rect x="7" y="12" width="2" height="2"/><rect x="15" y="16" width="2" height="2"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="8" width="16" height="8" rx="4"/><circle cx="8" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="16" cy="12" r="1.5" fill="currentColor"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12 Q6 6 9 12 T15 12 T21 12"/><circle cx="6" cy="9" r="1" fill="currentColor"/><circle cx="12" cy="15" r="1" fill="currentColor"/><circle cx="18" cy="9" r="1" fill="currentColor"/></svg>',
        ],
        objects: [
          {name:'DNA HELIX', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><g>' + Array.from({length:9},(_,i)=>{const y=15+i*9;const x1=50+Math.sin(i*0.7)*25;const x2=50-Math.sin(i*0.7)*25;return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="oklch(0.85 0.14 85)" stroke-width="1"/><circle cx="${x1}" cy="${y}" r="3" fill="oklch(0.75 0.17 155)"/><circle cx="${x2}" cy="${y}" r="3" fill="oklch(0.75 0.17 155)"/>`}).join('') + '</g><path d="M' + Array.from({length:9},(_,i)=>`${50+Math.sin(i*0.7)*25},${15+i*9}`).join(' L') + '" stroke="currentColor" fill="none"/><path d="M' + Array.from({length:9},(_,i)=>`${50-Math.sin(i*0.7)*25},${15+i*9}`).join(' L') + '" stroke="currentColor" fill="none"/></svg>'},
          {name:'RIBOSOME', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="50" cy="40" rx="32" ry="20" fill="oklch(0.28 0.08 155 / 0.5)"/><ellipse cx="50" cy="65" rx="30" ry="15" fill="oklch(0.28 0.08 155 / 0.7)"/><path d="M10 52 L90 52" stroke="oklch(0.85 0.14 85)" stroke-width="2" stroke-dasharray="3 2"/><rect x="48" y="48" width="4" height="8" fill="oklch(0.85 0.14 85)"/>' + Array.from({length:8},(_,i)=>`<circle cx="${30+i*5}" cy="${35+((i%2)*6)}" r="1.5" fill="currentColor"/>`).join('') + '</svg>'},
        ],
      },
      {
        id: 'cell', title: 'Cell Biology', chinese: '细胞生物学', code: 'BIO-M2',
        hue: 'oklch(0.82 0.17 110)',
        tagline: 'The living unit — membranes, organelles, and the choreography of life.',
        formula: 'n cells → 2n (mitosis)',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/><ellipse cx="7" cy="10" rx="2" ry="1"/><ellipse cx="16" cy="14" rx="1.5" ry="2"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="12" rx="10" ry="6"/><path d="M6 10 Q9 6 12 10 T18 10 M6 14 Q9 10 12 14 T18 14" opacity="0.5"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3Q6 9 6 12 T12 21Q18 15 18 12T12 3Z"/><path d="M10 10 Q12 8 14 10" opacity="0.5"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="12" r="5"/><circle cx="16" cy="12" r="5"/><circle cx="8" cy="12" r="1.5" fill="currentColor"/><circle cx="16" cy="12" r="1.5" fill="currentColor"/></svg>',
        ],
        objects: [
          {name:'ANIMAL CELL', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="50" cy="50" rx="42" ry="38" fill="oklch(0.28 0.08 110 / 0.35)"/><circle cx="52" cy="48" r="12" fill="oklch(0.82 0.17 110 / 0.5)" stroke="currentColor"/><circle cx="52" cy="48" r="4" fill="oklch(0.85 0.14 85)"/><ellipse cx="28" cy="60" rx="8" ry="4" fill="oklch(0.28 0.08 110 / 0.6)" stroke="currentColor" stroke-width="1"/><ellipse cx="72" cy="65" rx="6" ry="3" fill="oklch(0.28 0.08 110 / 0.6)" stroke="currentColor" stroke-width="1"/><path d="M25 35 Q35 30 45 35" stroke="currentColor"/><circle cx="35" cy="30" r="2" fill="currentColor"/><circle cx="30" cy="75" r="2" fill="oklch(0.85 0.14 85)"/><circle cx="70" cy="30" r="2" fill="oklch(0.85 0.14 85)"/></svg>'},
          {name:'MITOSIS', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><g transform="translate(30 50)"><ellipse rx="18" ry="14" fill="oklch(0.28 0.08 110 / 0.4)"/>' + [[-6,0],[0,3],[3,-4],[-3,-3],[6,3]].map(([x,y])=>`<path d="M${x-1} ${y-3} L${x-1} ${y+3} M${x+1} ${y-3} L${x+1} ${y+3}" stroke="oklch(0.85 0.14 85)" stroke-width="2"/>`).join('') + '</g><g transform="translate(70 50)"><ellipse rx="18" ry="14" fill="oklch(0.28 0.08 110 / 0.4)"/>' + [[-6,0],[0,3],[3,-4],[-3,-3],[6,3]].map(([x,y])=>`<path d="M${x-1} ${y-3} L${x-1} ${y+3} M${x+1} ${y-3} L${x+1} ${y+3}" stroke="oklch(0.85 0.14 85)" stroke-width="2"/>`).join('') + '</g><path d="M48 50 L52 50" stroke="currentColor" stroke-width="2"/></svg>'},
        ],
      },
      {
        id: 'gen', title: 'Genetics', chinese: '遗传学', code: 'BIO-M3',
        hue: 'oklch(0.72 0.17 245)',
        tagline: 'Traits passed, alleles mixed, mutations that matter — Mendel to CRISPR.',
        formula: 'Aa × Aa → 1AA : 2Aa : 1aa',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="5" r="2"/><circle cx="17" cy="5" r="2"/><path d="M12 7v4M12 11L7 15M12 11L17 15"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="8" y="3" width="8" height="8"/><rect x="8" y="13" width="8" height="8"/><path d="M12 3L12 11M12 13L12 21M8 7h8M8 17h8" opacity="0.5"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 3v9a3 3 0 003 3h0M18 3v9a3 3 0 01-3 3h0M9 15v6M15 15v6M6 21h6M12 21h6"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="10" width="4" height="4"/><rect x="10" y="10" width="4" height="4" fill="currentColor"/><rect x="16" y="10" width="4" height="4"/><path d="M6 10V6M18 10V6M12 14v4M6 18h12" opacity="0.5"/></svg>',
        ],
        objects: [
          {name:'PUNNETT SQUARE', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="30" y="30" width="60" height="60" fill="oklch(0.28 0.08 245 / 0.3)"/><line x1="60" y1="30" x2="60" y2="90"/><line x1="30" y1="60" x2="90" y2="60"/><text x="40" y="25" font-family="Space Grotesk" font-size="12" fill="currentColor" font-weight="600" stroke="none">A</text><text x="70" y="25" font-family="Space Grotesk" font-size="12" fill="currentColor" font-weight="600" stroke="none">a</text><text x="22" y="48" font-family="Space Grotesk" font-size="12" fill="currentColor" font-weight="600" stroke="none">A</text><text x="22" y="78" font-family="Space Grotesk" font-size="12" fill="currentColor" font-weight="600" stroke="none">a</text><text x="39" y="50" font-family="Space Grotesk" font-size="10" fill="oklch(0.85 0.14 85)" stroke="none">AA</text><text x="68" y="50" font-family="Space Grotesk" font-size="10" fill="currentColor" stroke="none">Aa</text><text x="39" y="80" font-family="Space Grotesk" font-size="10" fill="currentColor" stroke="none">Aa</text><text x="68" y="80" font-family="Space Grotesk" font-size="10" fill="currentColor" stroke="none">aa</text></svg>'},
          {name:'KARYOTYPE', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><g>' + Array.from({length:6},(_,i)=>{const x=12+i*14;const h=20+Math.random()*15;return `<rect x="${x}" y="20" width="3" height="${h}" rx="1" fill="oklch(0.72 0.17 245 / 0.7)"/><rect x="${x+5}" y="20" width="3" height="${h-3}" rx="1" fill="oklch(0.72 0.17 245 / 0.7)"/><text x="${x}" y="85" font-family="JetBrains Mono" font-size="6" fill="currentColor">${i+1}</text>`}).join('') + '</g><text x="5" y="12" font-family="JetBrains Mono" font-size="7" fill="oklch(0.85 0.14 85)">KARYOTYPE · 46,XY</text></svg>'},
        ],
      },
      {
        id: 'eco', title: 'Ecology', chinese: '生态学', code: 'BIO-M4',
        hue: 'oklch(0.72 0.15 140)',
        tagline: 'Organisms and environment — webs of energy, matter, and interdependence.',
        formula: 'N(t) = N₀e^(rt)',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3L8 9H11L7 15H10L6 21H18L14 15H17L13 9H16L12 3Z" fill="currentColor" opacity="0.2"/><path d="M12 3L8 9H11L7 15H10L6 21H18L14 15H17L13 9H16L12 3Z"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6" cy="18" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 17L11 13M14 11L16 8M14 13L17 17"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 20 Q4 14 8 14 Q12 14 12 20M12 20 Q12 10 16 10 Q20 10 20 20M4 20h16"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L16 8L10 8L14 14L8 14L12 20L6 14L10 14L6 8L12 8Z"/><path d="M8 20h8" opacity="0.5"/></svg>',
        ],
        objects: [
          {name:'FOOD WEB', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1"><circle cx="20" cy="80" r="8" fill="oklch(0.28 0.08 140 / 0.5)" stroke="currentColor"/><circle cx="50" cy="80" r="8" fill="oklch(0.28 0.08 140 / 0.5)" stroke="currentColor"/><circle cx="80" cy="80" r="8" fill="oklch(0.28 0.08 140 / 0.5)" stroke="currentColor"/><circle cx="30" cy="50" r="9" fill="oklch(0.72 0.15 140 / 0.6)" stroke="currentColor"/><circle cx="70" cy="50" r="9" fill="oklch(0.72 0.15 140 / 0.6)" stroke="currentColor"/><circle cx="50" cy="20" r="10" fill="oklch(0.85 0.14 85 / 0.6)" stroke="oklch(0.85 0.14 85)"/><g stroke="currentColor" fill="none">' + [[20,72,30,58],[50,72,30,58],[50,72,70,58],[80,72,70,58],[30,42,50,30],[70,42,50,30]].map(([x1,y1,x2,y2])=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#arr)"/>`).join('') + '</g><defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="currentColor"/></marker></defs></svg>'},
          {name:'BIOME', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1"><path d="M0 75 Q25 65 50 75 Q75 85 100 70 L100 100 L0 100 Z" fill="oklch(0.28 0.08 140)"/><path d="M0 75 Q25 65 50 75 Q75 85 100 70" stroke="currentColor"/>' + Array.from({length:6},(_,i)=>`<g transform="translate(${10+i*15} ${60+Math.random()*15})"><line x1="0" y1="0" x2="0" y2="10" stroke="oklch(0.55 0.10 80)" stroke-width="1.5"/><circle cx="0" cy="-3" r="${4+Math.random()*3}" fill="oklch(0.72 0.15 140)"/></g>`).join('') + '<circle cx="80" cy="20" r="6" fill="oklch(0.85 0.14 85)"/><path d="M 10 45 Q 25 43 40 45" stroke="oklch(0.92 0.02 220)" opacity="0.5"/></svg>'},
        ],
      },
      {
        id: 'evo', title: 'Evolution', chinese: '进化论', code: 'BIO-M5',
        hue: 'oklch(0.72 0.13 70)',
        tagline: 'Descent with modification — four billion years of branching, tested at every step.',
        formula: 'fitness(x) = # offspring(x)',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 21V3M12 14L6 8M12 14L18 8M12 8L8 4M12 8L16 4"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12 Q6 6 9 12 T15 12 T21 12"/><path d="M3 12 Q6 8 9 12 T15 12 T21 12" opacity="0.6"/><circle cx="21" cy="12" r="2" fill="currentColor"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2 Q7 6 12 10 Q17 6 12 2Z"/><path d="M12 10 Q4 14 12 18 Q20 14 12 10Z"/><path d="M12 18 L12 22"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4" stroke="oklch(0.85 0.14 85)"/></svg>',
        ],
        objects: [
          {name:'PHYLOGENETIC TREE', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M50 90 L50 70 L30 60 L30 40 L20 30 M30 40 L40 30 M50 70 L70 60 L70 40 L60 30 M70 40 L80 30"/><g fill="oklch(0.72 0.13 70)">' + [[20,30],[40,30],[60,30],[80,30]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="4"/>`).join('') + '</g><circle cx="50" cy="90" r="3" fill="oklch(0.85 0.14 85)"/><text x="14" y="22" font-family="JetBrains Mono" font-size="7" fill="currentColor">A</text><text x="36" y="22" font-family="JetBrains Mono" font-size="7" fill="currentColor">B</text><text x="56" y="22" font-family="JetBrains Mono" font-size="7" fill="currentColor">C</text><text x="76" y="22" font-family="JetBrains Mono" font-size="7" fill="currentColor">D</text></svg>'},
          {name:'NATURAL SELECTION', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1"><g>' + Array.from({length:5},(_,i)=>{const size=i===2?8:5;const fill=i===2?'oklch(0.85 0.14 85)':'oklch(0.72 0.13 70 / 0.7)';return `<circle cx="${15+i*15}" cy="30" r="${size}" fill="${fill}"/>`}).join('') + '</g><text x="15" y="15" font-family="JetBrains Mono" font-size="7" fill="currentColor">GEN 1</text><g>' + Array.from({length:5},(_,i)=>{const fill=i<3?'oklch(0.85 0.14 85)':'oklch(0.72 0.13 70 / 0.5)';const size=i<3?7:4;return `<circle cx="${15+i*15}" cy="70" r="${size}" fill="${fill}"/>`}).join('') + '</g><text x="15" y="55" font-family="JetBrains Mono" font-size="7" fill="currentColor">GEN 10</text><path d="M15 35 L15 65 M75 35 L75 65" stroke="currentColor" stroke-dasharray="2 2" opacity="0.4"/></svg>'},
        ],
      },
      {
        id: 'phys-b', title: 'Physiology', chinese: '生理学', code: 'BIO-M6',
        hue: 'oklch(0.75 0.16 15)',
        tagline: 'How bodies work — organs in concert, hormones as messengers.',
        formula: 'CO = HR × SV',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20 L4 12 Q1 9 4 6 Q7 3 12 8 Q17 3 20 6 Q23 9 20 12Z"/><path d="M8 11 L10 13 L14 9 L16 11" stroke="oklch(0.85 0.14 85)"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 3 Q9 9 6 9 Q3 9 3 13 Q3 17 6 17 L10 17M15 3 Q15 9 18 9 Q21 9 21 13 Q21 17 18 17 L14 17"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 3 Q6 3 6 6 L6 13 Q6 17 9 18L9 22M15 3 Q18 3 18 6 L18 13 Q18 17 15 18L15 22"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12 L6 12 L8 8 L11 16 L13 10 L16 14 L18 12 L21 12"/></svg>',
        ],
        objects: [
          {name:'CARDIAC CYCLE', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="10" y="25" width="80" height="50" fill="oklch(0.15 0.04 265)" stroke="currentColor"/><path d="M10 50 L20 50 L25 45 L28 55 L30 45 L35 55 L40 50 L55 50 L60 40 L63 60 L65 35 L68 55 L72 50 L90 50" stroke="oklch(0.75 0.16 15)" stroke-width="1.5" fill="none"/><text x="14" y="22" font-family="JetBrains Mono" font-size="7" fill="oklch(0.85 0.14 85)">ECG · 72bpm</text></svg>'},
          {name:'HEART', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M50 85 Q20 60 20 38 Q20 20 35 20 Q45 20 50 30 Q55 20 65 20 Q80 20 80 38 Q80 60 50 85 Z" fill="oklch(0.28 0.08 15 / 0.4)"/><path d="M50 30 L50 75" stroke="currentColor"/><circle cx="35" cy="35" r="4" fill="oklch(0.72 0.16 15 / 0.6)"/><circle cx="65" cy="35" r="4" fill="oklch(0.72 0.16 15 / 0.6)"/><circle cx="35" cy="55" r="6" fill="oklch(0.85 0.14 85 / 0.5)"/><circle cx="65" cy="55" r="6" fill="oklch(0.85 0.14 85 / 0.5)"/><path d="M35 20 L30 10 M65 20 L70 10" stroke="currentColor"/></svg>'},
        ],
      },
    ],
  },

  /* ================= MATHEMATICS ================= */
  {
    id: 'math', title: 'Mathematics', chinese: '数学', parent: 'MAT',
    note: 'The language in which the universe chose to write itself.',
    subs: [
      {
        id: 'alg', title: 'Algebra', chinese: '代数', code: 'MAT-M1',
        hue: 'oklch(0.72 0.17 245)',
        tagline: 'The art of the unknown — symbols that stand in for numbers.',
        formula: 'ax² + bx + c = 0',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><text x="12" y="17" text-anchor="middle" font-family="Space Grotesk" font-weight="600" font-size="14" fill="currentColor" stroke="none">x²</text></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="9" width="18" height="6"/><rect x="3" y="9" width="4" height="6" fill="currentColor" opacity="0.5"/><path d="M7 9v6M11 9v6M15 9v6" opacity="0.3"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12h18M12 3v18" opacity="0.3"/><path d="M3 18 Q12 3 21 18" stroke="oklch(0.85 0.14 85)"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="8" height="16" rx="1"/><path d="M5 8h4M5 12h4M5 16h4" opacity="0.5"/><rect x="13" y="4" width="8" height="16" rx="1"/><path d="M15 8h4M15 12h4M15 16h4" opacity="0.5"/></svg>',
        ],
        objects: [
          {name:'PARABOLA', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="10" y1="50" x2="90" y2="50"/><line x1="50" y1="10" x2="50" y2="90"/><path d="M18 18 Q30 68 50 80 Q70 68 82 18" stroke="oklch(0.85 0.14 85)" stroke-width="2" fill="none"/><circle cx="50" cy="80" r="3" fill="oklch(0.85 0.14 85)"/><text x="53" y="88" font-family="JetBrains Mono" font-size="7" fill="currentColor">vertex</text><text x="80" y="22" font-family="JetBrains Mono" font-size="7" fill="currentColor">y=x²</text></svg>'},
          {name:'MATRIX', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 20 L10 20 L10 80 L15 80 M85 20 L90 20 L90 80 L85 80"/>' + [[0,0,'3'],[1,0,'1'],[2,0,'4'],[0,1,'2'],[1,1,'5'],[2,1,'0'],[0,2,'6'],[1,2,'7'],[2,2,'9']].map(([c,r,v])=>`<text x="${25+c*22}" y="${35+r*22}" font-family="JetBrains Mono" font-size="11" fill="currentColor" stroke="none">${v}</text>`).join('') + '</svg>'},
        ],
      },
      {
        id: 'geo-m', title: 'Geometry', chinese: '几何学', code: 'MAT-M2',
        hue: 'oklch(0.82 0.17 125)',
        tagline: 'Shape, space, and symmetry — the axioms of Euclid and beyond.',
        formula: 'a² + b² = c²',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 20 L12 4 L20 20 Z"/><path d="M8 20 L16 20 M12 20 L12 12" opacity="0.4"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><line x1="12" y1="12" x2="21" y2="12" stroke="oklch(0.85 0.14 85)"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="16" height="16"/><path d="M4 4l16 16M20 4L4 20" opacity="0.4"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L22 8V16L12 22L2 16V8Z"/><path d="M2 8L12 14L22 8M12 14V22" opacity="0.4"/></svg>',
        ],
        objects: [
          {name:'PYTHAGORAS', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 75 L60 75 L60 35 Z" fill="oklch(0.28 0.08 125 / 0.4)"/><rect x="60" y="35" width="40" height="40" fill="oklch(0.82 0.17 125 / 0.3)"/><rect x="20" y="75" width="40" height="15" fill="oklch(0.72 0.17 125 / 0.3)"/><path d="M20 55 L35 55 L35 75" stroke="currentColor"/><text x="35" y="72" font-family="JetBrains Mono" font-size="8" fill="currentColor" stroke="none">a</text><text x="62" y="57" font-family="JetBrains Mono" font-size="8" fill="currentColor" stroke="none">b</text><text x="36" y="50" font-family="JetBrains Mono" font-size="8" fill="oklch(0.85 0.14 85)" stroke="none">c</text></svg>'},
          {name:'PLATONIC SOLID', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M50 15 L85 40 L75 75 L25 75 L15 40 Z" fill="oklch(0.28 0.08 125 / 0.4)"/><path d="M50 15 L50 50 L25 75 M50 50 L75 75 M50 50 L15 40 M50 50 L85 40" stroke="currentColor" opacity="0.7"/></svg>'},
        ],
      },
      {
        id: 'calc', title: 'Calculus', chinese: '微积分', code: 'MAT-M3',
        hue: 'oklch(0.75 0.17 25)',
        tagline: 'The mathematics of change — slopes, areas, and infinitesimals.',
        formula: '∫f(x)dx · df/dx',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 3 Q15 3 15 8 L15 16 Q15 21 9 21"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 18 L9 18 Q9 3 21 3"/><path d="M12 9 L16 9 L16 12 L12 12 Z" opacity="0.3" fill="currentColor"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 16 Q6 6 12 10 Q18 14 20 6" stroke="oklch(0.85 0.14 85)"/><path d="M8 13 L16 7" stroke="currentColor" stroke-dasharray="2 2"/><circle cx="10" cy="12" r="1.5" fill="currentColor"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 18h16M4 18L4 10" />' + Array.from({length:5},(_,i)=>`<rect x="${5+i*3}" y="${14-i*1.5}" width="2" height="${4+i*1.5}" fill="currentColor" opacity="0.4"/>`).join('') + '<path d="M4 14 Q12 6 20 10" stroke="oklch(0.85 0.14 85)"/></svg>',
        ],
        objects: [
          {name:'INTEGRAL', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="10" y1="80" x2="90" y2="80"/><line x1="10" y1="15" x2="10" y2="80"/><path d="M15 70 Q30 30 55 40 Q75 48 85 22" stroke="currentColor" fill="none" stroke-width="2"/><path d="M25 65 L25 40 M35 58 L35 37 M45 45 L45 37 M55 40 L55 40 M65 43 L65 35 M75 33 L75 26" stroke="oklch(0.85 0.14 85)"/><path d="M25 65 L25 80 L85 80 L85 22" fill="oklch(0.85 0.14 85 / 0.15)" stroke="none"/><text x="13" y="10" font-family="JetBrains Mono" font-size="7" fill="currentColor">f(x)</text></svg>'},
          {name:'LIMIT', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1"><line x1="10" y1="85" x2="90" y2="85"/><line x1="10" y1="10" x2="10" y2="85"/><line x1="10" y1="35" x2="90" y2="35" stroke="oklch(0.85 0.14 85)" stroke-dasharray="3 3"/><path d="M10 80 Q30 40 50 36 Q70 35 90 35" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="50" cy="35" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><text x="50" y="28" font-family="JetBrains Mono" font-size="8" fill="oklch(0.85 0.14 85)">L = 5</text><text x="55" y="95" font-family="JetBrains Mono" font-size="7" fill="currentColor">x → a</text></svg>'},
        ],
      },
      {
        id: 'stat', title: 'Statistics', chinese: '统计学', code: 'MAT-M4',
        hue: 'oklch(0.82 0.17 110)',
        tagline: 'Finding patterns in noise — probability, inference, and data.',
        formula: 'μ, σ² · p(H|E) ∝ p(E|H)p(H)',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 18 Q12 3 21 18"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="12" width="3" height="8"/><rect x="9" y="8" width="3" height="12"/><rect x="14" y="4" width="3" height="16"/><rect x="19" y="10" width="3" height="10"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 3A9 9 0 0 1 20 16L12 12Z" fill="currentColor" opacity="0.3"/><line x1="12" y1="12" x2="20" y2="16"/><line x1="12" y1="12" x2="12" y2="3"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6" cy="16" r="1" fill="currentColor"/><circle cx="9" cy="11" r="1" fill="currentColor"/><circle cx="12" cy="14" r="1" fill="currentColor"/><circle cx="15" cy="8" r="1" fill="currentColor"/><circle cx="18" cy="6" r="1" fill="currentColor"/><path d="M5 18 Q12 10 19 4" stroke="oklch(0.85 0.14 85)" stroke-dasharray="3 2"/></svg>',
        ],
        objects: [
          {name:'NORMAL DIST', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="10" y1="80" x2="90" y2="80"/><path d="M10 80 Q25 78 40 50 Q50 20 60 50 Q75 78 90 80" stroke="currentColor" stroke-width="2" fill="oklch(0.82 0.17 110 / 0.2)"/><line x1="50" y1="80" x2="50" y2="30" stroke="oklch(0.85 0.14 85)" stroke-dasharray="2 2"/><line x1="40" y1="80" x2="40" y2="50" stroke="currentColor" stroke-dasharray="2 2" opacity="0.4"/><line x1="60" y1="80" x2="60" y2="50" stroke="currentColor" stroke-dasharray="2 2" opacity="0.4"/><text x="47" y="25" font-family="JetBrains Mono" font-size="7" fill="oklch(0.85 0.14 85)">μ</text><text x="36" y="92" font-family="JetBrains Mono" font-size="7" fill="currentColor">−σ</text><text x="56" y="92" font-family="JetBrains Mono" font-size="7" fill="currentColor">+σ</text></svg>'},
          {name:'SCATTERPLOT', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1"><line x1="10" y1="85" x2="90" y2="85"/><line x1="10" y1="10" x2="10" y2="85"/>' + Array.from({length:20},()=>{const x=15+Math.random()*70;const y=80-(x-15)*0.8+((Math.random()-0.5)*20);return `<circle cx="${x}" cy="${y}" r="2" fill="oklch(0.82 0.17 110)"/>`}).join('') + '<path d="M15 75 L85 20" stroke="oklch(0.85 0.14 85)" stroke-dasharray="3 3"/><text x="15" y="22" font-family="JetBrains Mono" font-size="7" fill="oklch(0.85 0.14 85)">r = 0.87</text></svg>'},
        ],
      },
      {
        id: 'topo', title: 'Topology', chinese: '拓扑学', code: 'MAT-M5',
        hue: 'oklch(0.72 0.17 295)',
        tagline: 'Geometry without distance — what stays true when shapes bend and stretch.',
        formula: 'V − E + F = 2',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="12" rx="9" ry="5"/><ellipse cx="12" cy="12" rx="3" ry="1.5"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 7 Q6 3 12 3 Q18 3 18 7 L18 17 Q18 21 12 21 Q6 21 6 17 Z"/><path d="M9 10 Q9 8 12 8 Q15 8 15 10 L15 14 Q15 16 12 16 Q9 16 9 14 Z" opacity="0.5"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 12 Q4 4 12 4 Q20 4 20 12 Q20 20 12 20 Q4 20 4 12Z"/><path d="M4 12 Q12 8 20 12" opacity="0.5"/><path d="M4 12 Q12 16 20 12" opacity="0.5"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 12 Q6 6 12 6 Q18 6 18 12 Q18 18 12 18 Q6 18 6 12Z"/><path d="M12 6 Q8 9 8 12 Q8 15 12 18 Q16 15 16 12 Q16 9 12 6Z"/></svg>',
        ],
        objects: [
          {name:'TORUS', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="50" cy="50" rx="38" ry="22" fill="oklch(0.28 0.08 295 / 0.4)"/><ellipse cx="50" cy="50" rx="38" ry="22" stroke="currentColor"/><ellipse cx="50" cy="47" rx="14" ry="5" stroke="currentColor"/><path d="M36 48 Q50 56 64 48" stroke="currentColor"/><text x="20" y="18" font-family="JetBrains Mono" font-size="7" fill="oklch(0.85 0.14 85)">genus 1</text></svg>'},
          {name:'MÖBIUS STRIP', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 50 Q20 25 50 25 Q80 25 80 50 Q80 65 65 65 Q50 65 50 50 Q50 35 65 35 Q80 35 80 50" fill="none" stroke="currentColor"/><path d="M20 55 Q20 30 50 30 Q80 30 80 55 Q80 70 65 70 Q50 70 50 55 Q50 40 65 40 Q80 40 80 55" fill="none" stroke="oklch(0.72 0.17 295)" opacity="0.6"/></svg>'},
        ],
      },
      {
        id: 'num', title: 'Number Theory', chinese: '数论', code: 'MAT-M6',
        hue: 'oklch(0.85 0.14 85)',
        tagline: 'The queen of mathematics — primes, modular arithmetic, and unsolved mysteries.',
        formula: 'p prime ⇔ (p-1)! ≡ -1 (mod p)',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><text x="12" y="17" text-anchor="middle" font-family="Space Grotesk" font-weight="600" font-size="16" fill="currentColor" stroke="none">7</text></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><circle cx="12" cy="12" r="2"/><path d="M8 6h8M6 8v8M16 8v8M8 18h8" opacity="0.3"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><text x="12" y="15" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="currentColor" stroke="none">mod n</text></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 20L10 4M14 4l5 16M8 12h10" stroke-linecap="round"/></svg>',
        ],
        objects: [
          {name:'PRIME SIEVE', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1">' + (()=>{const primes=[2,3,5,7,11,13,17,19,23,29,31,37,41,43,47];let s='';for(let i=0;i<25;i++){const r=Math.floor(i/5);const c=i%5;const n=i+1;const isPrime=primes.includes(n);s+=`<rect x="${10+c*16}" y="${15+r*16}" width="14" height="14" fill="${isPrime?'oklch(0.85 0.14 85 / 0.6)':'oklch(0.28 0.08 85 / 0.3)'}" stroke="currentColor"/>`;s+=`<text x="${17+c*16}" y="${26+r*16}" text-anchor="middle" font-family="JetBrains Mono" font-size="7" fill="currentColor" stroke="none">${n}</text>`;}return s;})() + '</svg>'},
          {name:'MODULAR CLOCK', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="50" cy="50" r="35"/>' + Array.from({length:12},(_,i)=>{const a=(i/12)*2*Math.PI-Math.PI/2;const x=50+Math.cos(a)*29;const y=50+Math.sin(a)*29+2;return `<text x="${x}" y="${y}" text-anchor="middle" font-family="JetBrains Mono" font-size="7" fill="currentColor" stroke="none">${i}</text>`}).join('') + '<line x1="50" y1="50" x2="65" y2="30" stroke="oklch(0.85 0.14 85)" stroke-width="2"/><circle cx="50" cy="50" r="2" fill="oklch(0.85 0.14 85)"/><text x="30" y="96" font-family="JetBrains Mono" font-size="7" fill="currentColor">mod 12</text></svg>'},
        ],
      },
    ],
  },

  /* ================= COMPUTER SCIENCE ================= */
  {
    id: 'cs', title: 'Computer Science', chinese: '计算机科学', parent: 'CS',
    note: 'Computation, information, and the study of what machines can be made to do.',
    subs: [
      {
        id: 'algo', title: 'Algorithms', chinese: '算法', code: 'CS-M1',
        hue: 'oklch(0.75 0.17 200)',
        tagline: 'Recipes for computation — sort, search, optimize, and prove bounds.',
        formula: 'O(n log n) · O(n²)',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="18" width="3" height="3"/><rect x="7.5" y="15" width="3" height="6"/><rect x="12" y="10" width="3" height="11"/><rect x="16.5" y="6" width="3" height="15"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="9" cy="19" r="2"/><circle cx="15" cy="19" r="2"/><path d="M11 7l-3 3M13 7l3 3M7 14l1.5 3M17 14l-1.5 3"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 3 A6 6 0 1 1 5 15" /><circle cx="5" cy="18" r="2" fill="currentColor"/><path d="M15 15 L20 20" stroke="oklch(0.85 0.14 85)"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 8 Q9 4 12 12 T21 16" stroke="oklch(0.85 0.14 85)"/><path d="M3 8 L8 8 L8 4 M21 16 L16 16 L16 20" opacity="0.5"/></svg>',
        ],
        objects: [
          {name:'BINARY TREE', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="50" y1="25" x2="25" y2="55"/><line x1="50" y1="25" x2="75" y2="55"/><line x1="25" y1="55" x2="12" y2="85"/><line x1="25" y1="55" x2="38" y2="85"/><line x1="75" y1="55" x2="62" y2="85"/><line x1="75" y1="55" x2="88" y2="85"/><g fill="oklch(0.28 0.08 200 / 0.7)">' + [[50,25],[25,55],[75,55],[12,85],[38,85],[62,85],[88,85]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="8" stroke="currentColor"/>`).join('') + '</g><g font-family="JetBrains Mono" font-size="8" fill="currentColor" stroke="none" text-anchor="middle">' + [[50,28,'8'],[25,58,'3'],[75,58,'14'],[12,88,'1'],[38,88,'6'],[62,88,'11'],[88,88,'20']].map(([x,y,v])=>`<text x="${x}" y="${y}">${v}</text>`).join('') + '</g></svg>'},
          {name:'SORTING', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1">' + [7,3,9,1,5,8,2,6,4].map((n,i)=>`<rect x="${10+i*9}" y="${85-n*7}" width="7" height="${n*7}" fill="oklch(0.72 0.17 200 / 0.6)" stroke="currentColor"/>`).join('') + '<line x1="10" y1="85" x2="90" y2="85" stroke="currentColor"/>' + [1,2,3,4,5,6,7,8,9].map((n,i)=>`<rect x="${10+i*9}" y="${10}" width="7" height="${2}" fill="oklch(0.85 0.14 85)" opacity="${0.3+n*0.05}"/>`).join('') + '<text x="10" y="8" font-family="JetBrains Mono" font-size="6" fill="oklch(0.85 0.14 85)">SORTED</text></svg>'},
        ],
      },
      {
        id: 'sys', title: 'Operating Systems', chinese: '操作系统', code: 'CS-M2',
        hue: 'oklch(0.72 0.17 275)',
        tagline: 'The layer between hardware and intent — processes, memory, and files.',
        formula: 'process · thread · syscall',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 9h18" opacity="0.5"/><circle cx="6" cy="7" r="0.8" fill="currentColor"/><circle cx="9" cy="7" r="0.8" fill="currentColor"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="8" width="18" height="8" rx="1"/>' + Array.from({length:6},(_,i)=>`<line x1="${6+i*3}" y1="8" x2="${6+i*3}" y2="16" opacity="0.4"/>`).join('') + '<rect x="6" y="10" width="3" height="4" fill="currentColor"/><rect x="12" y="10" width="6" height="4" fill="oklch(0.85 0.14 85)" stroke="none"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4" opacity="0.5"/><path d="M9 12h6M9 15h4" opacity="0.5"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="6" width="6" height="6"/><rect x="15" y="6" width="6" height="6"/><rect x="9" y="14" width="6" height="6"/><path d="M9 9h6M12 12v2" opacity="0.5"/></svg>',
        ],
        objects: [
          {name:'PROCESS TABLE', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1"><rect x="10" y="15" width="80" height="70" fill="oklch(0.15 0.04 265)" stroke="currentColor"/><g stroke="currentColor" opacity="0.3">' + Array.from({length:5},(_,i)=>`<line x1="10" y1="${25+i*12}" x2="90" y2="${25+i*12}"/>`).join('') + '</g><g font-family="JetBrains Mono" font-size="6" fill="oklch(0.85 0.14 85)" stroke="none">' + [['PID','CMD','CPU','MEM'],['342','init','0.1','1.2M'],['512','bash','0.3','2.1M'],['721','gcc','45.2','128M'],['891','node','12.1','64M']].map((r,i)=>r.map((c,j)=>`<text x="${13+j*20}" y="${23+i*12}">${c}</text>`).join('')).join('') + '</g></svg>'},
          {name:'MEMORY MAP', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="30" y="10" width="40" height="80" fill="oklch(0.15 0.04 265)" stroke="currentColor"/><rect x="30" y="10" width="40" height="15" fill="oklch(0.72 0.17 275 / 0.6)" stroke="currentColor"/><rect x="30" y="25" width="40" height="20" fill="oklch(0.85 0.14 85 / 0.4)" stroke="currentColor"/><rect x="30" y="60" width="40" height="30" fill="oklch(0.72 0.17 275 / 0.4)" stroke="currentColor"/><g font-family="JetBrains Mono" font-size="6" fill="currentColor" stroke="none"><text x="32" y="20">CODE</text><text x="32" y="36">DATA</text><text x="32" y="54">↓ HEAP</text><text x="32" y="74">STACK ↑</text></g><text x="75" y="14" font-family="JetBrains Mono" font-size="5" fill="oklch(0.85 0.14 85)">0x0</text><text x="75" y="90" font-family="JetBrains Mono" font-size="5" fill="oklch(0.85 0.14 85)">0xFF</text></svg>'},
        ],
      },
      {
        id: 'ai-m', title: 'AI & Machine Learning', chinese: '人工智能与机器学习', code: 'CS-M3',
        hue: 'oklch(0.72 0.17 335)',
        tagline: 'Programs that learn from data — gradients, networks, and emergent behavior.',
        formula: 'w := w − η∇L(w)',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="4" cy="6" r="1.5"/><circle cx="4" cy="12" r="1.5"/><circle cx="4" cy="18" r="1.5"/><circle cx="12" cy="8" r="1.5"/><circle cx="12" cy="16" r="1.5"/><circle cx="20" cy="12" r="1.5"/><path d="M5.5 6L10.5 8M5.5 12L10.5 8M5.5 12L10.5 16M5.5 18L10.5 16M13.5 8L18.5 12M13.5 16L18.5 12" opacity="0.5"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 18 Q8 18 8 10 Q10 4 14 10 Q14 18 21 18"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="6" height="6"/><rect x="3" y="15" width="6" height="6"/><rect x="15" y="3" width="6" height="6" fill="currentColor" opacity="0.3"/><rect x="15" y="15" width="6" height="6"/><path d="M9 6h6M9 18h6M6 9v6M18 9v6" opacity="0.5"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3 Q8 8 12 12 Q16 8 12 3Z"/><path d="M3 12 Q8 16 12 12 Q8 8 3 12Z"/><path d="M12 21 Q16 16 12 12 Q8 16 12 21Z"/><path d="M21 12 Q16 8 12 12 Q16 16 21 12Z"/></svg>',
        ],
        objects: [
          {name:'NEURAL NET', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1"><g>' + (()=>{let s='';const layers=[[20,30],[20,50],[20,70],[50,22],[50,42],[50,62],[50,82],[80,40],[80,60]];const links=[];for(const[x1,y1]of layers.filter(p=>p[0]===20))for(const[x2,y2]of layers.filter(p=>p[0]===50))links.push([x1,y1,x2,y2]);for(const[x1,y1]of layers.filter(p=>p[0]===50))for(const[x2,y2]of layers.filter(p=>p[0]===80))links.push([x1,y1,x2,y2]);for(const[x1,y1,x2,y2]of links)s+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="oklch(0.72 0.17 335 / 0.3)"/>`;for(const[x,y]of layers)s+=`<circle cx="${x}" cy="${y}" r="4" fill="oklch(0.28 0.08 335 / 0.7)" stroke="currentColor"/>`;return s;})() + '</g><text x="16" y="92" font-family="JetBrains Mono" font-size="6" fill="currentColor">IN</text><text x="45" y="92" font-family="JetBrains Mono" font-size="6" fill="currentColor">HIDDEN</text><text x="75" y="92" font-family="JetBrains Mono" font-size="6" fill="currentColor">OUT</text></svg>'},
          {name:'LOSS CURVE', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="10" y1="85" x2="90" y2="85"/><line x1="10" y1="10" x2="10" y2="85"/><path d="M10 20 Q15 25 20 40 Q30 65 40 72 Q50 76 65 78 Q80 80 90 81" stroke="oklch(0.85 0.14 85)" stroke-width="2" fill="none"/><path d="M10 25 Q20 55 35 72 Q55 80 90 82" stroke="currentColor" stroke-width="1" opacity="0.5" stroke-dasharray="3 2"/><text x="15" y="22" font-family="JetBrains Mono" font-size="7" fill="currentColor">loss</text><text x="70" y="93" font-family="JetBrains Mono" font-size="7" fill="currentColor">epoch</text></svg>'},
        ],
      },
      {
        id: 'gfx', title: 'Computer Graphics', chinese: '计算机图形学', code: 'CS-M4',
        hue: 'oklch(0.72 0.17 310)',
        tagline: 'Making pixels lie convincingly — ray-tracing, shaders, and 3D geometry.',
        formula: 'L = ∫ f_r(x,ω,ωi) L_i cosθ dω',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6L12 3L21 6L21 18L12 21L3 18Z"/><path d="M3 6L12 10L21 6M12 10L12 21" opacity="0.5"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4 L12 4 L20 20 L12 20 Z"/><path d="M12 4 L12 20M4 4 L20 20" opacity="0.5"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="8" fill="oklch(0.28 0.08 310 / 0.4)"/><circle cx="9" cy="10" r="2" fill="currentColor" opacity="0.5"/><path d="M2 18 L12 12 M22 2 L12 12" stroke="oklch(0.85 0.14 85)" stroke-width="0.8"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><g>' + Array.from({length:5},(_,i)=>Array.from({length:5},(_,j)=>`<rect x="${3+i*3.6}" y="${3+j*3.6}" width="3" height="3" fill="oklch(0.72 0.17 310 / ${0.2+Math.random()*0.8})"/>`).join('')).join('') + '</g></svg>',
        ],
        objects: [
          {name:'WIREFRAME', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1"><g transform="translate(50 50)"><g stroke="oklch(0.72 0.17 310)"><path d="M-30 -20 L30 -20 L35 -5 L35 30 L-25 30 L-30 -20 Z"/><path d="M-30 -20 L-25 30 M30 -20 L35 -5 M35 30 L30 -20" opacity="0.5"/></g><g stroke="oklch(0.85 0.14 85)" stroke-width="0.5">' + Array.from({length:6},(_,i)=>`<line x1="${-30+i*10}" y1="-20" x2="${-25+i*10}" y2="30"/>`).join('') + Array.from({length:5},(_,i)=>`<line x1="-30" y1="${-20+i*10}" x2="35" y2="${-20+i*10}" opacity="0.5"/>`).join('') + '</g></g></svg>'},
          {name:'RAY TRACE', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1"><rect x="8" y="35" width="12" height="30" fill="oklch(0.28 0.08 310 / 0.4)" stroke="currentColor"/><circle cx="70" cy="55" r="18" fill="oklch(0.72 0.17 310 / 0.4)" stroke="currentColor"/><circle cx="85" cy="25" r="4" fill="oklch(0.85 0.14 85)"/><g stroke="oklch(0.85 0.14 85)" stroke-width="0.8">' + Array.from({length:5},(_,i)=>{const y=38+i*6;return `<path d="M20 ${y} L 52 ${y+((y-50)*0.1)}"/><path d="M 52 ${y+((y-50)*0.1)} L 83 27"/>`}).join('') + '</g><text x="8" y="30" font-family="JetBrains Mono" font-size="6" fill="currentColor">EYE</text><text x="78" y="14" font-family="JetBrains Mono" font-size="6" fill="oklch(0.85 0.14 85)">SUN</text></svg>'},
        ],
      },
      {
        id: 'sec', title: 'Security & Cryptography', chinese: '信息安全', code: 'CS-M5',
        hue: 'oklch(0.75 0.16 15)',
        tagline: 'The mathematics of secrets — keys, ciphers, and proofs-without-revealing.',
        formula: 'c = m^e mod n',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V7 A4 4 0 0 1 16 7V11"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="15" r="3"/><path d="M8 12V8L20 4V7"/><path d="M17 6V9M14 7V10" opacity="0.5"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3L4 6L4 12 Q4 18 12 21 Q20 18 20 12 L20 6Z"/><path d="M9 12L11 14L15 10" stroke="oklch(0.85 0.14 85)"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M6 8h12M6 12h8M6 16h10" opacity="0.4"/><path d="M17 13L19 15L22 12" stroke="oklch(0.85 0.14 85)" stroke-width="2"/></svg>',
        ],
        objects: [
          {name:'RSA KEYS', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><g transform="translate(25 50)"><rect x="-15" y="-10" width="30" height="20" rx="3" fill="oklch(0.82 0.14 85 / 0.5)" stroke="oklch(0.85 0.14 85)"/><circle cx="-8" cy="0" r="3"/><text x="-5" y="3" font-family="JetBrains Mono" font-size="6" fill="currentColor" stroke="none">PUB</text></g><g transform="translate(75 50)"><rect x="-15" y="-10" width="30" height="20" rx="3" fill="oklch(0.28 0.08 15 / 0.5)" stroke="currentColor"/><path d="M-8 -3 L-8 3 L-4 3 M-8 0 L-5 0" stroke="currentColor"/><text x="-2" y="3" font-family="JetBrains Mono" font-size="6" fill="currentColor" stroke="none">PRIV</text></g><path d="M42 50 L58 50" stroke="oklch(0.85 0.14 85)" stroke-dasharray="2 2"/></svg>'},
          {name:'HASH', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="8" y="25" width="25" height="16" rx="2" fill="oklch(0.28 0.06 15 / 0.4)" stroke="currentColor"/><text x="11" y="36" font-family="JetBrains Mono" font-size="8" fill="currentColor" stroke="none">hello</text><g transform="translate(50 33)"><rect x="-8" y="-8" width="16" height="16" fill="oklch(0.75 0.16 15 / 0.4)" stroke="currentColor"/><text x="0" y="3" text-anchor="middle" font-family="JetBrains Mono" font-size="6" fill="oklch(0.85 0.14 85)" stroke="none">H()</text></g><rect x="65" y="25" width="28" height="16" rx="2" fill="oklch(0.28 0.06 15 / 0.4)" stroke="currentColor"/><text x="67" y="36" font-family="JetBrains Mono" font-size="6" fill="oklch(0.85 0.14 85)" stroke="none">2cf24…</text><line x1="33" y1="33" x2="42" y2="33" stroke="currentColor"/><line x1="58" y1="33" x2="65" y2="33" stroke="currentColor"/><text x="30" y="60" font-family="JetBrains Mono" font-size="6" fill="currentColor">one-way</text></svg>'},
        ],
      },
      {
        id: 'net', title: 'Networks & Distributed', chinese: '网络与分布式', code: 'CS-M6',
        hue: 'oklch(0.78 0.12 190)',
        tagline: 'Computers in conversation — packets, protocols, consensus across continents.',
        formula: 'TCP · UDP · HTTP · 2f+1',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="9" ry="4"/><ellipse cx="12" cy="12" rx="4" ry="9"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><circle cx="12" cy="12" r="2"/><path d="M7 7L10 11M17 7L14 11M7 17L10 13M17 17L14 13" opacity="0.5"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="6" width="6" height="12" rx="1"/><rect x="15" y="6" width="6" height="12" rx="1"/><path d="M9 12h6" stroke-dasharray="2 2"/><rect x="11" y="10" width="2" height="4" fill="currentColor"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="2"/><path d="M8 12 Q12 8 16 12 M6 12 Q12 4 18 12 M4 12 Q12 0 20 12" opacity="0.6"/></svg>',
        ],
        objects: [
          {name:'NETWORK TOPOLOGY', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="50" cy="50" r="8" fill="oklch(0.85 0.14 85 / 0.5)" stroke="oklch(0.85 0.14 85)"/>' + [[20,20],[80,20],[20,80],[80,80],[50,15],[15,50],[85,50],[50,85]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="5" fill="oklch(0.28 0.06 190 / 0.6)" stroke="currentColor"/><line x1="50" y1="50" x2="${x}" y2="${y}" stroke="currentColor" opacity="0.5" stroke-dasharray="2 2"/>`).join('') + '</svg>'},
          {name:'PACKET', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="15" y="30" width="70" height="40" fill="oklch(0.28 0.06 190 / 0.5)" stroke="currentColor"/><rect x="15" y="30" width="15" height="40" fill="oklch(0.78 0.12 190 / 0.4)" stroke="currentColor"/><rect x="30" y="30" width="15" height="40" fill="oklch(0.78 0.12 190 / 0.3)" stroke="currentColor"/><rect x="45" y="30" width="30" height="40" fill="oklch(0.85 0.14 85 / 0.3)" stroke="currentColor"/><rect x="75" y="30" width="10" height="40" fill="oklch(0.78 0.12 190 / 0.4)" stroke="currentColor"/><g font-family="JetBrains Mono" font-size="5" fill="currentColor" stroke="none"><text x="17" y="52">SRC</text><text x="32" y="52">DST</text><text x="54" y="52">PAYLOAD</text><text x="77" y="52">CHK</text></g><text x="15" y="25" font-family="JetBrains Mono" font-size="7" fill="oklch(0.85 0.14 85)">PKT · 64B</text></svg>'},
        ],
      },
    ],
  },

  /* ================= ASTRONOMY ================= */
  {
    id: 'astro', title: 'Astronomy', chinese: '天文学', parent: 'AST',
    note: 'Everything beyond our atmosphere — planets, stars, galaxies, and the cosmos itself.',
    subs: [
      {
        id: 'plan', title: 'Planetary Science', chinese: '行星科学', code: 'AST-M1',
        hue: 'oklch(0.75 0.17 55)',
        tagline: 'Worlds in orbit — atmospheres, geology, and habitability beyond Earth.',
        formula: 'T² ∝ a³ (Kepler III)',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="6" fill="currentColor" opacity="0.3"/><circle cx="12" cy="12" r="6"/><path d="M6 10 Q12 12 18 10" opacity="0.5"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="4" fill="currentColor"/><ellipse cx="12" cy="12" rx="10" ry="3" transform="rotate(-20 12 12)"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="18" cy="6" r="3" fill="currentColor"/><circle cx="10" cy="14" r="5"/><ellipse cx="14" cy="14" rx="10" ry="3" transform="rotate(30 14 14)" opacity="0.4"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3" fill="currentColor"/><circle cx="12" cy="12" r="8"/><ellipse cx="12" cy="12" rx="10" ry="3"/></svg>',
        ],
        objects: [
          {name:'ORBIT', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="50" cy="55" r="30" stroke="currentColor" stroke-dasharray="2 3"/><ellipse cx="50" cy="55" rx="35" ry="25" stroke="oklch(0.75 0.17 55)" stroke-width="1"/><circle cx="50" cy="55" r="7" fill="oklch(0.85 0.14 85)"/><circle cx="78" cy="50" r="4" fill="oklch(0.75 0.17 55)"/><circle cx="18" cy="70" r="3" fill="oklch(0.72 0.17 245)"/><text x="14" y="15" font-family="JetBrains Mono" font-size="7" fill="currentColor">T = 1yr</text></svg>'},
          {name:'EXOPLANET', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="35" cy="45" r="18" fill="oklch(0.85 0.14 85 / 0.6)"/><circle cx="80" cy="40" r="6" fill="oklch(0.75 0.17 55)" stroke="currentColor"/><path d="M35 45 L74 40" stroke="oklch(0.85 0.14 85)" stroke-dasharray="2 2" opacity="0.6"/><g font-family="JetBrains Mono" font-size="7" fill="currentColor" stroke="none"><text x="10" y="85">KEPLER-442b</text><text x="10" y="95">r = 1.34 R⊕</text></g></svg>'},
        ],
      },
      {
        id: 'stel', title: 'Stellar Astronomy', chinese: '恒星天文学', code: 'AST-M2',
        hue: 'oklch(0.85 0.14 85)',
        tagline: 'Stars from birth to death — fusion, supernovae, and black holes.',
        formula: 'L ∝ M^3.5 · H-R diagram',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L14 9L22 9L15 14L17 22L12 17L7 22L9 14L2 9L10 9Z" fill="currentColor" opacity="0.3"/><path d="M12 2L14 9L22 9L15 14L17 22L12 17L7 22L9 14L2 9L10 9Z"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="4" fill="currentColor"/><circle cx="12" cy="12" r="8" opacity="0.5"/><circle cx="12" cy="12" r="11" opacity="0.3"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2 L12 7M12 17 L12 22M2 12 L7 12M17 12 L22 12M5 5L8 8M16 16L19 19M19 5L16 8M5 19L8 16" stroke-linecap="round"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="5" fill="currentColor"/><path d="M3 3 Q12 8 21 3 M3 21 Q12 16 21 21" opacity="0.5"/></svg>',
        ],
        objects: [
          {name:'HR DIAGRAM', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1"><line x1="10" y1="85" x2="90" y2="85"/><line x1="10" y1="10" x2="10" y2="85"/>' + Array.from({length:40},()=>{const T=Math.random();const L=Math.random();const x=10+(1-T)*75;const y=85-L*70;const size=1+L*2;let c='oklch(0.95 0.02 240)';if(T>0.7)c='oklch(0.72 0.17 25)';else if(T>0.4)c='oklch(0.85 0.14 85)';return `<circle cx="${x}" cy="${y}" r="${size}" fill="${c}"/>`}).join('') + '<path d="M20 18 Q45 55 85 75" stroke="oklch(0.85 0.14 85 / 0.4)" stroke-width="8" fill="none" opacity="0.3"/><g font-family="JetBrains Mono" font-size="6" fill="currentColor"><text x="13" y="15">L</text><text x="82" y="93">T</text></g></svg>'},
          {name:'SUPERNOVA', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1"><circle cx="50" cy="50" r="28" fill="oklch(0.85 0.14 85 / 0.15)"/><circle cx="50" cy="50" r="20" fill="oklch(0.85 0.14 85 / 0.3)"/><circle cx="50" cy="50" r="10" fill="oklch(0.85 0.14 85 / 0.7)"/><circle cx="50" cy="50" r="3" fill="oklch(0.95 0.05 60)"/><g stroke="oklch(0.85 0.14 85)" stroke-width="0.5">' + Array.from({length:16},(_,i)=>{const a=i*22.5*Math.PI/180;return `<line x1="${50+Math.cos(a)*12}" y1="${50+Math.sin(a)*12}" x2="${50+Math.cos(a)*42}" y2="${50+Math.sin(a)*42}"/>`}).join('') + '</g></svg>'},
        ],
      },
      {
        id: 'cos', title: 'Cosmology', chinese: '宇宙学', code: 'AST-M3',
        hue: 'oklch(0.72 0.17 295)',
        tagline: 'The universe as a whole — Big Bang, dark matter, and the shape of everything.',
        formula: 'H₀ ≈ 73 km/s/Mpc',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12 Q12 3 21 12 Q12 21 3 12Z" fill="currentColor" opacity="0.1"/><path d="M3 12 Q12 3 21 12 Q12 21 3 12Z"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 12 L22 3 M12 12 L2 3 M12 12 L22 21 M12 12 L2 21 M12 12 L12 2 M12 12 L12 22 M12 12 L2 12 M12 12 L22 12"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 3 Q6 12 12 21 Q18 12 12 3 M3 12 Q12 6 21 12 Q12 18 3 12"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6" cy="6" r="1" fill="currentColor"/><circle cx="18" cy="6" r="1" fill="currentColor"/><circle cx="6" cy="18" r="1" fill="currentColor"/><circle cx="18" cy="18" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><path d="M3 3 Q12 12 21 21 M21 3 Q12 12 3 21" opacity="0.3"/></svg>',
        ],
        objects: [
          {name:'CMB MAP', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1"><ellipse cx="50" cy="50" rx="42" ry="30" fill="oklch(0.28 0.08 295 / 0.5)" stroke="currentColor"/><g clip-path="url(#cmb-clip)">' + Array.from({length:60},()=>{const x=10+Math.random()*80;const y=22+Math.random()*56;const r=2+Math.random()*4;const hue=Math.random()<0.5?'oklch(0.72 0.17 295 / 0.6)':'oklch(0.85 0.14 85 / 0.5)';return `<circle cx="${x}" cy="${y}" r="${r}" fill="${hue}"/>`}).join('') + '</g><defs><clipPath id="cmb-clip"><ellipse cx="50" cy="50" rx="42" ry="30"/></clipPath></defs><text x="10" y="92" font-family="JetBrains Mono" font-size="7" fill="oklch(0.85 0.14 85)">T = 2.725K</text></svg>'},
          {name:'EXPANSION', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1"><g>' + [0,1,2,3].map(i=>{const r=10+i*8;const o=1-i*0.25;return `<circle cx="50" cy="50" r="${r}" fill="none" stroke="oklch(0.72 0.17 295)" opacity="${o}"/>`}).join('') + '</g>' + Array.from({length:12},(_,i)=>{const a=i*30*Math.PI/180;return `<g><circle cx="${50+Math.cos(a)*30}" cy="${50+Math.sin(a)*30}" r="1.5" fill="oklch(0.85 0.14 85)"/><path d="M${50+Math.cos(a)*20} ${50+Math.sin(a)*20} L ${50+Math.cos(a)*32} ${50+Math.sin(a)*32}" stroke="oklch(0.85 0.14 85)" stroke-width="0.5"/></g>`}).join('') + '<circle cx="50" cy="50" r="3" fill="oklch(0.85 0.14 85)"/><text x="15" y="15" font-family="JetBrains Mono" font-size="6" fill="currentColor">H₀t</text></svg>'},
        ],
      },
      {
        id: 'obs', title: 'Observational Astronomy', chinese: '观测天文学', code: 'AST-M4',
        hue: 'oklch(0.78 0.13 215)',
        tagline: 'Listening to the sky — telescopes across every wavelength.',
        formula: 'λf = c · R ∝ D/λ',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 3L21 10M8 5 L5 8 L14 17 L17 14Z"/><path d="M5 8L2 11L6 15L9 12"/><path d="M7 16L3 20M12 13L17 8" opacity="0.5"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 4L18 12L12 12L6 12Z"/><path d="M12 12v8M8 20h8" stroke-width="1.5"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="7"/><line x1="15" y1="15" x2="21" y2="21" stroke-linecap="round"/><path d="M10 6v8M6 10h8" opacity="0.5"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4 L21 4 L21 8 L3 8Z" fill="currentColor" opacity="0.3"/><path d="M3 4 L21 4 L21 8 L3 8Z"/><path d="M6 12 L6 20 M12 12 L12 20 M18 12 L18 20" stroke-width="1"/></svg>',
        ],
        objects: [
          {name:'REFLECTOR', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="25" y="25" width="50" height="45" fill="oklch(0.28 0.06 215 / 0.5)" stroke="currentColor"/><path d="M25 25 Q50 45 75 25" fill="oklch(0.78 0.13 215 / 0.3)" stroke="oklch(0.85 0.14 85)"/><path d="M50 25 L50 20 M35 15 L65 15" stroke="currentColor"/><circle cx="50" cy="12" r="3" fill="none" stroke="currentColor"/><rect x="40" y="70" width="20" height="18" fill="oklch(0.28 0.06 215 / 0.6)" stroke="currentColor"/><path d="M35 90 L65 90" stroke="currentColor" stroke-width="2"/></svg>'},
          {name:'SKY CHART', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1"><circle cx="50" cy="50" r="42" fill="oklch(0.15 0.04 215)" stroke="currentColor"/>' + Array.from({length:50},()=>{const a=Math.random()*Math.PI*2;const r=Math.random()*40;const x=50+Math.cos(a)*r;const y=50+Math.sin(a)*r;const size=0.5+Math.random()*1.5;return `<circle cx="${x}" cy="${y}" r="${size}" fill="oklch(0.95 0.02 215)" opacity="${0.3+Math.random()*0.7}"/>`}).join('') + '<g stroke="oklch(0.85 0.14 85)" stroke-width="0.5" opacity="0.7">' + [[35,30,42,35],[42,35,48,28],[48,28,55,32],[55,32,60,40]].map(([x1,y1,x2,y2])=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`).join('') + '</g><text x="10" y="96" font-family="JetBrains Mono" font-size="6" fill="oklch(0.85 0.14 85)">ORION</text></svg>'},
        ],
      },
      {
        id: 'bio-a', title: 'Astrobiology', chinese: '天体生物学', code: 'AST-M5',
        hue: 'oklch(0.72 0.15 140)',
        tagline: 'Is there anyone out there? — habitable zones, biosignatures, and SETI.',
        formula: 'N = R* · fp · ne · fl · fi · fc · L',
        icons: [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="5" fill="currentColor" opacity="0.4"/><circle cx="12" cy="12" r="9" stroke-dasharray="2 3"/><path d="M12 3L12 7M12 17L12 21M3 12L7 12M17 12L21 12" opacity="0.5"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 20 Q6 14 12 14 Q18 14 18 20M4 20h16" /><circle cx="10" cy="9" r="2"/><circle cx="14" cy="9" r="2"/><circle cx="12" cy="5" r="1.5" fill="currentColor"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="2"/><circle cx="17" cy="7" r="2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M9 7h6M9 17h6M7 9v6M17 9v6" opacity="0.5"/></svg>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12 Q7 4 12 12 T22 12"/><path d="M2 16 Q7 8 12 16 T22 16" opacity="0.5"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>',
        ],
        objects: [
          {name:'HAB ZONE', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1"><circle cx="50" cy="50" r="40" fill="oklch(0.15 0.04 140)" stroke="currentColor"/><circle cx="50" cy="50" r="8" fill="oklch(0.85 0.14 85)"/><path d="M50 50 m-25 0 a 25 25 0 0 1 50 0 a 25 25 0 0 1 -50 0" fill="oklch(0.72 0.15 140 / 0.3)" stroke="oklch(0.72 0.15 140)" stroke-dasharray="3 2"/><path d="M50 50 m-18 0 a 18 18 0 0 1 36 0 a 18 18 0 0 1 -36 0" fill="none" stroke="oklch(0.85 0.14 85)" stroke-dasharray="2 2"/><circle cx="72" cy="50" r="3" fill="oklch(0.72 0.15 140)"/><text x="58" y="93" font-family="JetBrains Mono" font-size="6" fill="currentColor">GOLDILOCKS</text></svg>'},
          {name:'BIOSIGNATURE', svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1"><line x1="10" y1="80" x2="90" y2="80"/><line x1="10" y1="10" x2="10" y2="80"/><path d="M10 70 L15 68 L20 60 L25 55 L35 40 L45 30 L55 32 L65 50 L75 65 L85 70" stroke="oklch(0.72 0.15 140)" stroke-width="1.5" fill="none"/><g stroke="oklch(0.85 0.14 85)" stroke-width="2">' + [28,42,60].map((x,i)=>`<line x1="${x}" y1="80" x2="${x}" y2="${65-i*5}"/>`).join('') + '</g><g font-family="JetBrains Mono" font-size="6" fill="oklch(0.85 0.14 85)" stroke="none"><text x="24" y="78">H₂O</text><text x="38" y="53">O₂</text><text x="56" y="48">CH₄</text></g></svg>'},
        ],
      },
    ],
  },
];

window.DEEP_AREAS = DEEP_AREAS;
