(() => {
/* ========================================================
   Rocket / Space — 3 style explorations.
   7 sub-disciplines × 3 styles (Technical / Dark / Hologram)
======================================================== */

const SPACE_SUBS = [
  {id:'orb', title:'Orbital Mechanics',          chinese:'轨道力学',    code:'SPC-S1', hue:'#f59e0b', hueSoft:'rgba(245,158,11,0.15)', tagline:'Kepler, Hohmann, and the quiet geometry of falling around a planet.', formula:'T² = (4π²/GM)·a³'},
  {id:'prp', title:'Propulsion Systems',         chinese:'推进系统',    code:'SPC-S2', hue:'#fb923c', hueSoft:'rgba(251,146,60,0.15)', tagline:'Chemical, ion, nuclear — how we push mass against the cosmos.', formula:'Δv = Iₛₚ·g·ln(m₀/mf)'},
  {id:'lnv', title:'Launch Vehicles',            chinese:'运载火箭',    code:'SPC-S3', hue:'#60a5fa', hueSoft:'rgba(96,165,250,0.15)', tagline:'Staging, fairings, and every kilogram that reaches orbit.', formula:'Σ Δv = Δv_stage1 + Δv_stage2 …'},
  {id:'str', title:'Spacecraft Structures',      chinese:'航天器结构',  code:'SPC-S4', hue:'#94a3b8', hueSoft:'rgba(148,163,184,0.15)', tagline:'Thermal shields, pressure vessels, composites — life in a vacuum.', formula:'σ = F/A · q̇ = ε·σ·T⁴'},
  {id:'gnc', title:'Guidance · Nav · Control',   chinese:'制导与控制',  code:'SPC-S5', hue:'#22d3ee', hueSoft:'rgba(34,211,238,0.15)', tagline:'Star trackers, IMUs, reaction wheels — finding "this way" in space.', formula:'ẋ = Ax + Bu · y = Cx'},
  {id:'pln', title:'Planetary Science',          chinese:'行星科学',    code:'SPC-S6', hue:'#a78bfa', hueSoft:'rgba(167,139,250,0.15)', tagline:'Atmospheres, regolith, cratering — reading worlds from orbit.', formula:'g = GM/r²'},
  {id:'lfe', title:'Life Support & Habitats',    chinese:'生命保障',    code:'SPC-S7', hue:'#34d399', hueSoft:'rgba(52,211,153,0.15)', tagline:'ECLSS, crew modules, radiation shelter — keeping humans alive off-Earth.', formula:'O₂: 0.21·P · CO₂ < 0.5%'},
];

/* =================================================================
   STYLE A — TECHNICAL BLUEPRINT
================================================================= */
const tek = (hue, inner) => `<svg viewBox="0 0 100 100"><defs><pattern id="tgS${hue.replace('#','')}" patternUnits="userSpaceOnUse" width="10" height="10"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="#1e293b" stroke-width="0.3" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(#tgS${hue.replace('#','')})"/><g stroke="#0f172a" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`;

const tekObj = (hue, title, code, inner) => `<svg viewBox="0 0 200 200">
  <defs>
    <pattern id="tpS${code}" patternUnits="userSpaceOnUse" width="8" height="8"><path d="M 8 0 L 0 0 0 8" fill="none" stroke="#475569" stroke-width="0.25" opacity="0.15"/></pattern>
  </defs>
  <rect width="200" height="200" fill="url(#tpS${code})"/>
  <rect x="4" y="4" width="192" height="192" fill="none" stroke="#0f172a" stroke-width="0.8"/>
  <rect x="4" y="168" width="192" height="28" fill="none" stroke="#0f172a" stroke-width="0.8"/>
  <line x1="100" y1="168" x2="100" y2="196" stroke="#0f172a" stroke-width="0.6"/>
  <line x1="160" y1="168" x2="160" y2="196" stroke="#0f172a" stroke-width="0.6"/>
  <g font-family="JetBrains Mono, monospace" font-size="7" fill="#0f172a" letter-spacing="0.1em">
    <text x="10" y="179">${title}</text>
    <text x="10" y="191" opacity="0.6">SCALE 1:1 · ISO-A</text>
    <text x="107" y="179" opacity="0.7">${code}</text>
    <text x="107" y="191" opacity="0.5">REV 01</text>
    <text x="166" y="179" opacity="0.7">SHT 1/1</text>
    <text x="166" y="191" fill="${hue}">●</text><text x="175" y="191" opacity="0.5">SPC</text>
  </g>
  <g stroke="#0f172a" fill="none" stroke-linecap="round" stroke-linejoin="round">${inner}</g>
</svg>`;

const TECHNICAL = {
  orb: {
    icons: [
      tek('#f59e0b',`<circle cx="50" cy="50" r="8" fill="#f59e0b" stroke="none"/><ellipse cx="50" cy="50" rx="36" ry="22" stroke-width="1.2"/><ellipse cx="50" cy="50" rx="36" ry="22" stroke-width="1.2" transform="rotate(60 50 50)"/><circle cx="85" cy="42" r="3" fill="#0f172a" stroke="none"/>`),
      tek('#f59e0b',`<circle cx="50" cy="50" r="12" stroke-width="1.3"/><ellipse cx="50" cy="50" rx="30" ry="18" stroke-width="1.2" stroke-dasharray="2 2"/><ellipse cx="50" cy="50" rx="38" ry="25" stroke="#f59e0b" stroke-width="1.3"/><circle cx="50" cy="50" r="2" fill="#0f172a" stroke="none"/>`),
      tek('#f59e0b',`<path d="M10 55 Q 30 15 70 35 Q 90 45 90 55 Q 90 70 70 75 Q 30 85 10 55 Z" stroke-width="1.3"/><circle cx="50" cy="55" r="4" fill="#0f172a" stroke="none"/><line x1="50" y1="55" x2="10" y2="55" stroke="#f59e0b" stroke-dasharray="2 2"/><line x1="50" y1="55" x2="90" y2="55" stroke="#f59e0b" stroke-dasharray="2 2"/>`),
      tek('#f59e0b',`<circle cx="35" cy="55" r="12" stroke-width="1.3"/><circle cx="35" cy="55" r="3" fill="#0f172a" stroke="none"/><circle cx="75" cy="35" r="5" stroke-width="1.2"/><path d="M 35 55 Q 60 15 75 35" stroke="#f59e0b" stroke-dasharray="2 2"/><path d="M 35 55 Q 60 95 75 35" stroke-width="0.8" stroke-dasharray="1 2" opacity="0.4"/>`),
    ],
    objects: [
      { name:'HOHMANN TRANSFER', svg:tekObj('#f59e0b','HOHMANN XFER','S-S1-A01',`
        <circle cx="100" cy="90" r="8" fill="#f59e0b" stroke="none"/>
        <circle cx="100" cy="90" r="32" stroke-width="1.3" fill="none"/>
        <circle cx="100" cy="90" r="60" stroke-width="1.3" fill="none"/>
        <ellipse cx="100" cy="90" rx="46" ry="46" stroke="#f59e0b" stroke-width="1.5" fill="none" stroke-dasharray="3 2" transform="translate(-14 0)"/>
        <circle cx="68" cy="90" r="2.5" fill="#0f172a" stroke="none"/>
        <circle cx="160" cy="90" r="3.5" fill="#0f172a" stroke="none"/>
        <g stroke="#f59e0b" stroke-width="1.4"><path d="M 68 90 L 56 90"/><path d="M 60 86 L 56 90 L 60 94"/></g>
        <g stroke="#f59e0b" stroke-width="1.4"><path d="M 160 90 L 172 90"/><path d="M 168 86 L 172 90 L 168 94"/></g>
        <g font-family="JetBrains Mono" font-size="6" fill="#0f172a" stroke="none">
          <text x="58" y="82">Δv₁</text>
          <text x="150" y="82">Δv₂</text>
          <text x="104" y="94">SUN</text>
          <text x="48" y="106">r₁</text>
          <text x="152" y="106">r₂</text>
        </g>
      `)},
      { name:'KEPLER ORBIT', svg:tekObj('#f59e0b','KEPLER · ELLIPSE','S-S1-A02',`
        <ellipse cx="100" cy="90" rx="64" ry="42" stroke-width="1.4" fill="none"/>
        <circle cx="146" cy="90" r="6" fill="#f59e0b" stroke="none"/>
        <circle cx="54" cy="90" r="2" fill="#0f172a" stroke="none"/>
        <line x1="36" y1="90" x2="164" y2="90" stroke-width="0.5" stroke-dasharray="2 2"/>
        <line x1="100" y1="48" x2="100" y2="132" stroke-width="0.5" stroke-dasharray="2 2"/>
        <circle cx="90" cy="58" r="2.5" fill="#0f172a" stroke="none"/>
        <path d="M 146 90 L 90 58" stroke="#f59e0b" stroke-width="1"/>
        <path d="M 146 90 L 90 58 Q 140 72 150 90 Z" fill="#f59e0b" fill-opacity="0.15" stroke="none"/>
        <g stroke="#f59e0b" stroke-width="0.5">
          <line x1="36" y1="144" x2="164" y2="144"/><line x1="36" y1="142" x2="36" y2="146"/><line x1="164" y1="142" x2="164" y2="146"/>
          <text x="94" y="156" font-family="JetBrains Mono" font-size="6" stroke="none">2a</text>
        </g>
        <g font-family="JetBrains Mono" font-size="6" fill="#0f172a" stroke="none">
          <text x="148" y="84">F</text>
          <text x="78" y="52">m</text>
        </g>
        <text x="115" y="82" font-family="JetBrains Mono" font-size="5" fill="#f59e0b" stroke="none">dA/dt=const</text>
      `)},
    ],
  },
  prp: {
    icons: [
      tek('#fb923c',`<path d="M40 10 L60 10 L60 60 L70 60 L50 90 L30 60 L40 60 Z" stroke-width="1.3"/><circle cx="50" cy="35" r="6" stroke="#fb923c" stroke-width="1" fill="none"/><path d="M 30 60 L 26 72 L 40 68 Z" fill="#fb923c" fill-opacity="0.3" stroke-width="0.8"/><path d="M 70 60 L 74 72 L 60 68 Z" fill="#fb923c" fill-opacity="0.3" stroke-width="0.8"/>`),
      tek('#fb923c',`<rect x="25" y="38" width="50" height="24" stroke-width="1.3"/><rect x="20" y="42" width="10" height="16" stroke-width="1.2"/><path d="M 75 42 L 90 32 L 90 68 L 75 58 Z" stroke-width="1.3"/><circle cx="50" cy="50" r="3" fill="#fb923c" stroke="none"/><g stroke="#fb923c" stroke-width="0.8"><circle cx="40" cy="50" r="1.5" fill="#fb923c"/><circle cx="60" cy="50" r="1.5" fill="#fb923c"/><path d="M 38 50 L 62 50" stroke-dasharray="1 1"/></g>`),
      tek('#fb923c',`<circle cx="50" cy="50" r="18" stroke-width="1.3"/><circle cx="50" cy="50" r="28" stroke-width="1" stroke-dasharray="3 2"/><path d="M 44 35 L 56 35 L 56 45 L 52 45 L 52 48 L 56 48 L 56 58 L 44 58 L 44 48 L 48 48 L 48 45 L 44 45 Z" fill="#fb923c" fill-opacity="0.3" stroke-width="1"/><text x="14" y="82" font-family="JetBrains Mono" font-size="5" fill="#fb923c" stroke="none">NUCLEAR · TRISO</text>`),
      tek('#fb923c',`<path d="M 30 45 Q 30 25 50 25 Q 70 25 70 45 L 70 65 L 30 65 Z" stroke-width="1.3"/><line x1="30" y1="50" x2="70" y2="50" stroke-width="0.4" opacity="0.4"/><path d="M 35 65 L 38 85 L 42 65" stroke-width="1"/><path d="M 45 65 L 48 88 L 52 65" stroke-width="1"/><path d="M 55 65 L 58 85 L 62 65" stroke-width="1"/><g stroke="#fb923c"><path d="M 38 88 L 40 95 L 42 88" fill="#fb923c" fill-opacity="0.4" stroke-width="0.8"/><path d="M 48 91 L 50 98 L 52 91" fill="#fb923c" fill-opacity="0.4" stroke-width="0.8"/><path d="M 58 88 L 60 95 L 62 88" fill="#fb923c" fill-opacity="0.4" stroke-width="0.8"/></g>`),
    ],
    objects: [
      { name:'BELL NOZZLE', svg:tekObj('#fb923c','BELL NOZZLE','S-S2-A01',`
        <path d="M 60 30 L 140 30 L 140 60 Q 140 70 148 80 L 175 155 L 25 155 L 52 80 Q 60 70 60 60 Z" stroke-width="1.4" fill="none"/>
        <line x1="60" y1="60" x2="140" y2="60" stroke-width="0.6"/>
        <line x1="52" y1="80" x2="148" y2="80" stroke-width="0.6"/>
        <g stroke="#fb923c" stroke-width="0.6">
          <line x1="90" y1="40" x2="110" y2="40"/>
          <circle cx="90" cy="40" r="1.5"/><circle cx="110" cy="40" r="1.5"/>
          <text x="94" y="26" font-family="JetBrains Mono" font-size="5" stroke="none">CHAMBER</text>
        </g>
        <text x="68" y="75" font-family="JetBrains Mono" font-size="5" fill="#fb923c" stroke="none">THROAT</text>
        <line x1="52" y1="80" x2="148" y2="80" stroke="#fb923c" stroke-width="1"/>
        <path d="M 52 80 L 60 100 L 65 80" fill="#fb923c" fill-opacity="0.2" stroke="#f97316" stroke-width="1"/>
        <path d="M 140 80 L 148 80 L 140 100 Z" fill="#fb923c" fill-opacity="0.2" stroke="#f97316" stroke-width="1"/>
        <g stroke="#fb923c" stroke-width="0.8" fill="#fb923c" fill-opacity="0.5">
          <path d="M 50 155 L 100 190 L 150 155 Z" fill-opacity="0.15"/>
          <path d="M 80 155 L 100 175 L 120 155 Z" fill-opacity="0.3"/>
        </g>
        <g stroke="#0f172a" stroke-width="0.5">
          <line x1="25" y1="162" x2="175" y2="162"/><line x1="25" y1="160" x2="25" y2="164"/><line x1="175" y1="160" x2="175" y2="164"/>
          <text x="76" y="150" font-family="JetBrains Mono" font-size="6" stroke="none">Aₑ / Aₜ = 27</text>
        </g>
        <g stroke="#0f172a" stroke-width="0.5">
          <line x1="180" y1="30" x2="180" y2="155"/><line x1="178" y1="30" x2="182" y2="30"/><line x1="178" y1="155" x2="182" y2="155"/>
          <text x="184" y="96" font-family="JetBrains Mono" font-size="6" stroke="none">L=125mm</text>
        </g>
      `)},
      { name:'ION THRUSTER', svg:tekObj('#fb923c','ION ENGINE','S-S2-A02',`
        <rect x="25" y="65" width="100" height="60" stroke-width="1.4"/>
        <rect x="35" y="75" width="80" height="40" stroke-width="0.8" stroke-dasharray="2 2"/>
        <circle cx="75" cy="95" r="4" stroke-width="1" fill="#fb923c" fill-opacity="0.4"/>
        <circle cx="95" cy="95" r="4" stroke-width="1" fill="#fb923c" fill-opacity="0.4"/>
        <circle cx="55" cy="95" r="4" stroke-width="1" fill="#fb923c" fill-opacity="0.4"/>
        <text x="40" y="58" font-family="JetBrains Mono" font-size="6" fill="#0f172a" stroke="none">Xe TANK</text>
        <line x1="125" y1="80" x2="140" y2="80" stroke-width="2"/>
        <line x1="125" y1="110" x2="140" y2="110" stroke-width="2"/>
        <g stroke="#fb923c" stroke-width="0.9" fill="none">
          <line x1="140" y1="82" x2="175" y2="82"/>
          <line x1="140" y1="95" x2="180" y2="95"/>
          <line x1="140" y1="108" x2="175" y2="108"/>
          ${Array.from({length:8},(_,i)=>`<circle cx="${145+i*5}" cy="${85+(i%3)*5}" r="0.9" fill="#fb923c"/>`).join('')}
        </g>
        <g font-family="JetBrains Mono" font-size="5" fill="#fb923c" stroke="none">
          <text x="145" y="76">Xe⁺</text>
          <text x="152" y="126">30 keV</text>
        </g>
        <g stroke="#0f172a" stroke-width="0.5">
          <line x1="145" y1="46" x2="145" y2="62"/>
          <text x="148" y="56" font-family="JetBrains Mono" font-size="5" stroke="none">GRID</text>
        </g>
        <text x="30" y="148" font-family="JetBrains Mono" font-size="6" fill="#fb923c" stroke="none">Iₛₚ = 3000 s</text>
      `)},
    ],
  },
  lnv: {
    icons: [
      tek('#60a5fa',`<path d="M 50 10 L 58 25 L 58 70 L 42 70 L 42 25 Z" stroke-width="1.3"/><rect x="42" y="42" width="16" height="4" stroke-width="0.8"/><path d="M 42 70 L 32 85 L 42 80 Z" stroke-width="1.1"/><path d="M 58 70 L 68 85 L 58 80 Z" stroke-width="1.1"/><path d="M 44 85 L 56 85 L 50 95 Z" fill="#60a5fa" fill-opacity="0.3" stroke-width="1"/><circle cx="50" cy="20" r="2" fill="#60a5fa" stroke="none"/>`),
      tek('#60a5fa',`<rect x="35" y="12" width="30" height="30" stroke-width="1.2"/><path d="M 35 42 L 35 48 L 65 48 L 65 42 Z" stroke-width="1"/><rect x="35" y="48" width="30" height="24" stroke-width="1.3"/><path d="M 35 72 L 35 76 L 65 76 L 65 72 Z" stroke-width="1"/><rect x="40" y="76" width="20" height="16" stroke-width="1.2"/><g stroke="#60a5fa"><path d="M 45 88 L 47 95 L 49 88"/><path d="M 51 88 L 53 95 L 55 88"/></g><text x="14" y="30" font-family="JetBrains Mono" font-size="5" fill="#60a5fa" stroke="none">S3</text><text x="14" y="62" font-family="JetBrains Mono" font-size="5" fill="#60a5fa" stroke="none">S2</text><text x="14" y="88" font-family="JetBrains Mono" font-size="5" fill="#60a5fa" stroke="none">S1</text>`),
      tek('#60a5fa',`<path d="M 50 10 L 58 22 L 52 22 L 52 72 L 48 72 L 48 22 L 42 22 Z" stroke-width="1.3"/><rect x="30" y="38" width="12" height="28" stroke-width="1.2"/><rect x="58" y="38" width="12" height="28" stroke-width="1.2"/><path d="M 30 66 L 36 76 L 42 66" stroke-width="1"/><path d="M 58 66 L 64 76 L 70 66" stroke-width="1"/><path d="M 48 72 L 52 72 L 50 82 Z" fill="#60a5fa" fill-opacity="0.3" stroke-width="1"/>`),
      tek('#60a5fa',`<rect x="15" y="65" width="70" height="15" stroke-width="1.3"/><path d="M 20 65 L 35 35 L 45 35 L 30 65 Z" stroke-width="1.2"/><circle cx="30" cy="72" r="3" stroke-width="1"/><circle cx="50" cy="72" r="3" stroke-width="1"/><circle cx="70" cy="72" r="3" stroke-width="1"/><line x1="15" y1="85" x2="85" y2="85" stroke-width="0.8"/><g stroke-width="0.4" opacity="0.3">${Array.from({length:8},(_,i)=>`<line x1="${18+i*9}" y1="85" x2="${22+i*9}" y2="90"/>`).join('')}</g><text x="50" y="26" font-family="JetBrains Mono" font-size="5" fill="#60a5fa" stroke="none">TEL</text>`),
    ],
    objects: [
      { name:'STAGED VEHICLE', svg:tekObj('#60a5fa','2-STAGE · LV','S-S3-A01',`
        <path d="M 100 18 L 112 35 L 112 55 L 88 55 L 88 35 Z" stroke-width="1.4"/>
        <circle cx="100" cy="30" r="2" fill="#60a5fa" stroke="none"/>
        <rect x="88" y="55" width="24" height="50" stroke-width="1.4"/>
        <line x1="88" y1="62" x2="112" y2="62" stroke-width="0.4" stroke-dasharray="1 1"/>
        <rect x="88" y="105" width="24" height="4" stroke-width="1"/>
        <rect x="86" y="109" width="28" height="42" stroke-width="1.4"/>
        <rect x="88" y="151" width="24" height="4" stroke-width="1"/>
        <path d="M 86 151 L 78 170 L 86 166 Z" stroke-width="1.1"/>
        <path d="M 114 151 L 122 170 L 114 166 Z" stroke-width="1.1"/>
        <path d="M 94 166 L 106 166 L 100 180 Z" fill="#60a5fa" fill-opacity="0.4" stroke-width="1"/>
        <g stroke="#60a5fa" stroke-width="1.3"><line x1="62" y1="55" x2="84" y2="55"/><path d="M 66 51 L 62 55 L 66 59"/></g>
        <g stroke="#60a5fa" stroke-width="1.3"><line x1="62" y1="109" x2="84" y2="109"/><path d="M 66 105 L 62 109 L 66 113"/></g>
        <g font-family="JetBrains Mono" font-size="7" fill="#0f172a" stroke="none">
          <text x="36" y="42">PAYLOAD</text>
          <text x="36" y="76">STAGE 2</text>
          <text x="36" y="92" font-size="5" fill="#60a5fa">Δv=4.1 km/s</text>
          <text x="36" y="128">STAGE 1</text>
          <text x="36" y="144" font-size="5" fill="#60a5fa">Δv=5.7 km/s</text>
        </g>
        <g stroke="#0f172a" stroke-width="0.5">
          <line x1="130" y1="18" x2="130" y2="180"/><line x1="128" y1="18" x2="132" y2="18"/><line x1="128" y1="180" x2="132" y2="180"/>
          <text x="134" y="100" font-family="JetBrains Mono" font-size="6" stroke="none">h=70m</text>
        </g>
      `)},
      { name:'FAIRING SEPARATION', svg:tekObj('#60a5fa','FAIRING SEP','S-S3-A02',`
        <path d="M 100 28 L 114 55 L 114 115 L 86 115 L 86 55 Z" fill="#60a5fa" fill-opacity="0.1" stroke-width="0.5" stroke-dasharray="2 2"/>
        <path d="M 100 28 L 82 55 L 68 115" stroke-width="1.5"/>
        <path d="M 100 28 L 118 55 L 132 115" stroke-width="1.5"/>
        <path d="M 70 75 L 62 77 L 66 88 L 72 80 Z" fill="#60a5fa" fill-opacity="0.2" stroke-width="1.2"/>
        <path d="M 130 75 L 138 77 L 134 88 L 128 80 Z" fill="#60a5fa" fill-opacity="0.2" stroke-width="1.2"/>
        <rect x="94" y="90" width="12" height="38" stroke-width="1.3"/>
        <circle cx="100" cy="100" r="3" fill="#60a5fa" fill-opacity="0.4" stroke-width="0.8"/>
        <text x="102" y="106" font-family="JetBrains Mono" font-size="5" fill="#0f172a" stroke="none">SAT</text>
        <g stroke="#60a5fa" stroke-width="1.3">
          <path d="M 82 80 L 70 74"/><path d="M 74 72 L 68 74 L 72 78"/>
          <path d="M 118 80 L 130 74"/><path d="M 126 72 L 132 74 L 128 78"/>
        </g>
        <g font-family="JetBrains Mono" font-size="6" fill="#60a5fa" stroke="none">
          <text x="40" y="48">PORT</text>
          <text x="144" y="48">STBD</text>
          <text x="72" y="140">T+3:42</text>
        </g>
        <g stroke="#0f172a" stroke-width="0.5">
          <line x1="40" y1="160" x2="160" y2="160"/><line x1="40" y1="158" x2="40" y2="162"/><line x1="160" y1="158" x2="160" y2="162"/>
          <text x="82" y="156" font-family="JetBrains Mono" font-size="6" stroke="none">Ø 5.2m</text>
        </g>
      `)},
    ],
  },
  str: {
    icons: [
      tek('#94a3b8',`<path d="M 20 55 Q 50 25 80 55 L 80 85 L 20 85 Z" stroke-width="1.3"/><g stroke="#94a3b8" stroke-width="0.8">${Array.from({length:5},(_,i)=>`<path d="M ${22+i*14} 70 Q ${29+i*14} 60 ${36+i*14} 70" fill="none"/>`).join('')}</g><path d="M 20 55 Q 50 38 80 55" stroke="#94a3b8" stroke-width="0.6" stroke-dasharray="2 2"/><text x="14" y="22" font-family="JetBrains Mono" font-size="5" fill="#94a3b8" stroke="none">ABLATIVE · 1800K</text>`),
      tek('#94a3b8',`<circle cx="50" cy="55" r="28" stroke-width="1.3"/><circle cx="50" cy="55" r="22" stroke-width="0.8" stroke-dasharray="2 2"/><path d="M 38 55 L 62 55 M 50 43 L 50 67" stroke-width="1"/><g stroke="#94a3b8" stroke-width="1"><circle cx="40" cy="45" r="1.5" fill="#94a3b8"/><circle cx="60" cy="45" r="1.5" fill="#94a3b8"/><circle cx="40" cy="65" r="1.5" fill="#94a3b8"/><circle cx="60" cy="65" r="1.5" fill="#94a3b8"/></g><text x="14" y="22" font-family="JetBrains Mono" font-size="5" fill="#94a3b8" stroke="none">P = 1 atm</text>`),
      tek('#94a3b8',`<g stroke-width="1"><rect x="20" y="40" width="60" height="6"/><rect x="20" y="48" width="60" height="6" fill="#94a3b8" fill-opacity="0.2"/><rect x="20" y="56" width="60" height="6"/><rect x="20" y="64" width="60" height="6" fill="#94a3b8" fill-opacity="0.2"/><rect x="20" y="72" width="60" height="6"/></g><line x1="14" y1="40" x2="14" y2="78" stroke="#94a3b8"/><path d="M 12 40 L 14 36 L 16 40" stroke="#94a3b8"/><path d="M 12 78 L 14 82 L 16 78" stroke="#94a3b8"/><text x="82" y="60" font-family="JetBrains Mono" font-size="5" fill="#94a3b8" stroke="none">CFRP</text>`),
      tek('#94a3b8',`<g stroke-width="1.2">${Array.from({length:3},(_,r)=>Array.from({length:5},(_,i)=>`<circle cx="${20+i*15}" cy="${30+r*20}" r="6" fill="none"/>`).join('')).join('')}</g><g stroke="#94a3b8" stroke-width="0.6">${Array.from({length:5},(_,i)=>Array.from({length:2},(_,r)=>`<line x1="${20+i*15}" y1="${36+r*20}" x2="${20+i*15}" y2="${44+r*20}"/>`).join('')).join('')}</g>`),
    ],
    objects: [
      { name:'HEAT SHIELD', svg:tekObj('#94a3b8','TPS · LH²O','S-S4-A01',`
        <path d="M 30 120 Q 100 50 170 120" stroke-width="1.6" fill="none"/>
        <path d="M 30 120 Q 100 62 170 120" stroke-width="0.8"/>
        <path d="M 30 120 Q 100 80 170 120" stroke-width="0.8"/>
        <path d="M 30 120 L 170 120" stroke-width="1.4"/>
        <rect x="56" y="120" width="88" height="26" stroke-width="1.3" fill="#fff"/>
        <line x1="56" y1="132" x2="144" y2="132" stroke-width="0.5" stroke-dasharray="1 1"/>
        <g stroke="#f97316" stroke-width="1.2" fill="none">
          ${Array.from({length:9},(_,i)=>`<path d="M ${30+i*18} 30 L ${30+i*18} 48"/><path d="M ${26+i*18} 44 L ${30+i*18} 50 L ${34+i*18} 44"/>`).join('')}
        </g>
        <g stroke="#94a3b8" stroke-width="0.5">
          <line x1="30" y1="155" x2="170" y2="155"/><line x1="30" y1="153" x2="30" y2="157"/><line x1="170" y1="153" x2="170" y2="157"/>
          <text x="78" y="164" font-family="JetBrains Mono" font-size="6" fill="#0f172a" stroke="none">Ø 4.8m</text>
        </g>
        <g font-family="JetBrains Mono" font-size="6" fill="#0f172a" stroke="none">
          <text x="36" y="22">FLOW · 7.6 km/s</text>
          <text x="74" y="112" fill="#94a3b8">ABLATIVE LAYER</text>
          <text x="78" y="138" fill="#94a3b8">COMPOSITE</text>
          <text x="40" y="92">T_s ≈ 1900K</text>
        </g>
      `)},
      { name:'PRESSURE HULL', svg:tekObj('#94a3b8','HULL ASSY','S-S4-A02',`
        <rect x="30" y="60" width="140" height="70" rx="30" ry="30" stroke-width="1.4" fill="#fff"/>
        <line x1="60" y1="60" x2="60" y2="130" stroke-width="0.6" stroke-dasharray="2 2"/>
        <line x1="100" y1="60" x2="100" y2="130" stroke-width="0.6" stroke-dasharray="2 2"/>
        <line x1="140" y1="60" x2="140" y2="130" stroke-width="0.6" stroke-dasharray="2 2"/>
        ${Array.from({length:10},(_,i)=>{const a=i*36*Math.PI/180;return `<g transform="translate(40 95)"><circle cx="${Math.cos(a)*18}" cy="${Math.sin(a)*18}" r="1.5" stroke-width="0.6"/></g>`}).join('')}
        <circle cx="40" cy="95" r="18" stroke-width="1.2" fill="#fff"/>
        <circle cx="40" cy="95" r="14" stroke-width="0.6" stroke-dasharray="1 1"/>
        <text x="34" y="98" font-family="JetBrains Mono" font-size="5" fill="#0f172a" stroke="none">HATCH</text>
        <g stroke="#94a3b8" stroke-width="1" fill="none">
          <line x1="160" y1="80" x2="155" y2="80"/>
          <line x1="160" y1="95" x2="155" y2="95"/>
          <line x1="160" y1="110" x2="155" y2="110"/>
        </g>
        <g stroke="#f97316" stroke-width="1" fill="none">
          ${Array.from({length:4},(_,i)=>`<path d="M ${60+i*20} 50 L ${60+i*20} 58"/><path d="M ${56+i*20} 54 L ${60+i*20} 60 L ${64+i*20} 54"/>`).join('')}
        </g>
        <g stroke="#94a3b8" stroke-width="0.5">
          <line x1="30" y1="142" x2="170" y2="142"/><line x1="30" y1="140" x2="30" y2="144"/><line x1="170" y1="140" x2="170" y2="144"/>
          <text x="72" y="152" font-family="JetBrains Mono" font-size="6" fill="#0f172a" stroke="none">4200mm · Al-Li</text>
        </g>
        <text x="36" y="44" font-family="JetBrains Mono" font-size="6" fill="#f97316" stroke="none">P_int 101 kPa</text>
      `)},
    ],
  },
  gnc: {
    icons: [
      tek('#22d3ee',`<circle cx="50" cy="50" r="30" stroke-width="1.3"/><path d="M 50 20 L 50 80 M 20 50 L 80 50" stroke-width="0.5" stroke-dasharray="2 2"/><path d="M 40 40 L 60 60 M 60 40 L 40 60" stroke="#22d3ee" stroke-width="1"/><g fill="#22d3ee"><circle cx="28" cy="38" r="1.5"/><circle cx="68" cy="28" r="1.5"/><circle cx="72" cy="65" r="1.5"/><circle cx="34" cy="70" r="1.5"/><circle cx="55" cy="22" r="1.5"/></g>`),
      tek('#22d3ee',`<rect x="25" y="25" width="50" height="50" stroke-width="1.3"/><g stroke="#22d3ee" stroke-width="1"><line x1="50" y1="25" x2="50" y2="75" stroke-dasharray="2 2"/><line x1="25" y1="50" x2="75" y2="50" stroke-dasharray="2 2"/><line x1="35" y1="35" x2="65" y2="65"/><line x1="65" y1="35" x2="35" y2="65"/></g><circle cx="50" cy="50" r="3" fill="#0f172a"/><circle cx="50" cy="50" r="14" stroke="#22d3ee" stroke-width="0.7" fill="none"/><text x="14" y="22" font-family="JetBrains Mono" font-size="5" fill="#22d3ee" stroke="none">6-DoF IMU</text>`),
      tek('#22d3ee',`<circle cx="50" cy="50" r="22" stroke-width="1.3"/><circle cx="50" cy="50" r="14" stroke-width="1"/><circle cx="50" cy="50" r="6" fill="#0f172a"/>${Array.from({length:8},(_,i)=>{const a=i*45*Math.PI/180;return `<line x1="${50+Math.cos(a)*22}" y1="${50+Math.sin(a)*22}" x2="${50+Math.cos(a)*30}" y2="${50+Math.sin(a)*30}" stroke-width="0.8"/>`}).join('')}<path d="M 50 28 A 22 22 0 0 1 72 50" stroke="#22d3ee" stroke-width="2"/>`),
      tek('#22d3ee',`<path d="M 15 55 L 40 55 L 50 45 L 60 55 L 85 55" stroke-width="1.4"/><rect x="44" y="30" width="12" height="15" stroke-width="1.2"/><circle cx="15" cy="55" r="3" fill="#22d3ee"/><circle cx="85" cy="55" r="3" fill="#22d3ee"/><text x="20" y="45" font-family="JetBrains Mono" font-size="5" fill="#22d3ee" stroke="none">u</text><text x="72" y="45" font-family="JetBrains Mono" font-size="5" fill="#22d3ee" stroke="none">y</text><text x="44" y="70" font-family="JetBrains Mono" font-size="5" fill="#22d3ee" stroke="none">PLANT</text>`),
    ],
    objects: [
      { name:'STAR TRACKER', svg:tekObj('#22d3ee','STAR TRACK','S-S5-A01',`
        <rect x="35" y="50" width="80" height="55" rx="4" stroke-width="1.4"/>
        <circle cx="75" cy="77" r="18" stroke-width="1.3"/>
        <circle cx="75" cy="77" r="22" stroke-width="0.6" stroke-dasharray="2 2"/>
        <circle cx="75" cy="77" r="3" fill="#0f172a"/>
        <path d="M 115 60 L 130 55 L 140 70 L 135 90 L 130 105 L 115 100 Z" stroke-width="1.3" fill="#22d3ee" fill-opacity="0.15"/>
        <g stroke="#22d3ee" stroke-width="1" fill="none">
          <line x1="95" y1="77" x2="115" y2="77"/>
          <path d="M 111 73 L 115 77 L 111 81"/>
        </g>
        <rect x="118" y="73" width="12" height="10" stroke-width="1"/>
        <text x="119" y="82" font-family="JetBrains Mono" font-size="4" fill="#0f172a" stroke="none">CCD</text>
        <g fill="#0f172a" stroke="none">
          <circle cx="150" cy="50" r="1.4"/><circle cx="165" cy="65" r="1"/>
          <circle cx="168" cy="90" r="1.8"/><circle cx="155" cy="108" r="1"/>
          <circle cx="175" cy="75" r="1.2"/>
        </g>
        <g stroke="#22d3ee" stroke-width="0.5" stroke-dasharray="1 2">
          <line x1="140" y1="72" x2="150" y2="50"/>
          <line x1="140" y1="80" x2="168" y2="90"/>
          <line x1="140" y1="77" x2="175" y2="75"/>
        </g>
        <text x="40" y="128" font-family="JetBrains Mono" font-size="6" fill="#0f172a" stroke="none">RA 17h42m · DEC −23°</text>
        <text x="40" y="44" font-family="JetBrains Mono" font-size="6" fill="#22d3ee" stroke="none">ATT ± 2 arcsec</text>
      `)},
      { name:'REACTION WHEEL', svg:tekObj('#22d3ee','RW · 3-AXIS','S-S5-A02',`
        <circle cx="100" cy="92" r="42" stroke-width="1.4"/>
        <circle cx="100" cy="92" r="28" stroke-width="1" stroke-dasharray="2 2"/>
        <circle cx="100" cy="92" r="6" fill="#0f172a"/>
        ${Array.from({length:12},(_,i)=>{const a=i*30*Math.PI/180;return `<line x1="${100+Math.cos(a)*28}" y1="${92+Math.sin(a)*28}" x2="${100+Math.cos(a)*42}" y2="${92+Math.sin(a)*42}" stroke-width="1"/>`}).join('')}
        <g stroke="#22d3ee" stroke-width="1.4" fill="none">
          <path d="M 100 34 A 58 58 0 0 1 144 60"/>
          <path d="M 140 56 L 144 60 L 140 64"/>
        </g>
        <text x="118" y="48" font-family="JetBrains Mono" font-size="6" fill="#22d3ee" stroke="none">ω = 6000 rpm</text>
        <g stroke="#94a3b8" stroke-width="1" fill="none">
          <rect x="35" y="135" width="130" height="14"/>
          <line x1="60" y1="135" x2="60" y2="149"/>
          <line x1="85" y1="135" x2="85" y2="149"/>
          <line x1="115" y1="135" x2="115" y2="149"/>
          <line x1="140" y1="135" x2="140" y2="149"/>
        </g>
        <g font-family="JetBrains Mono" font-size="5" fill="#0f172a" stroke="none">
          <text x="42" y="145">BRG</text>
          <text x="66" y="145">HALL</text>
          <text x="90" y="145">ENC</text>
          <text x="120" y="145">PWR</text>
          <text x="145" y="145">CAN</text>
        </g>
      `)},
    ],
  },
  pln: {
    icons: [
      tek('#a78bfa',`<circle cx="50" cy="50" r="30" stroke-width="1.3"/><path d="M 22 42 Q 40 36 58 44 Q 72 52 78 46" fill="none" stroke="#a78bfa" stroke-width="1"/><path d="M 24 60 Q 42 54 56 62 Q 70 68 76 62" fill="none" stroke="#a78bfa" stroke-width="0.8"/><circle cx="38" cy="42" r="3" fill="#a78bfa" fill-opacity="0.3" stroke-width="0.8"/><circle cx="62" cy="58" r="4" fill="#a78bfa" fill-opacity="0.4" stroke-width="0.8"/><text x="14" y="22" font-family="JetBrains Mono" font-size="5" fill="#a78bfa" stroke="none">MARS</text>`),
      tek('#a78bfa',`<path d="M 15 75 Q 30 55 40 70 Q 55 50 65 72 Q 75 55 85 75 L 85 85 L 15 85 Z" stroke-width="1.3" fill="#a78bfa" fill-opacity="0.1"/><circle cx="28" cy="68" r="4" stroke-width="1"/><circle cx="30" cy="68" r="1" fill="#0f172a"/><circle cx="60" cy="65" r="6" stroke-width="1"/><circle cx="58" cy="64" r="2" fill="#0f172a"/><path d="M 50 30 Q 52 20 55 25 Q 60 22 58 32 Q 55 28 50 30 Z" stroke-width="1"/>`),
      tek('#a78bfa',`<circle cx="50" cy="50" r="28" stroke-width="1.3"/><circle cx="50" cy="50" r="6" fill="#a78bfa" fill-opacity="0.3" stroke-width="1.1"/><circle cx="42" cy="44" r="4" stroke-width="0.8"/><circle cx="56" cy="58" r="5" stroke-width="0.8"/><circle cx="62" cy="42" r="3" stroke-width="0.8"/><circle cx="40" cy="62" r="3.5" stroke-width="0.8"/><g stroke="#a78bfa" stroke-width="0.6" fill="none">${Array.from({length:5},(_,i)=>`<line x1="${42+Math.cos(i)*8}" y1="${50+Math.sin(i)*4}" x2="${50+Math.cos(i)*2}" y2="${50+Math.sin(i)*2}" stroke-dasharray="1 1"/>`).join('')}</g>`),
      tek('#a78bfa',`<line x1="15" y1="80" x2="85" y2="80" stroke-width="1.3"/><g stroke="#a78bfa" stroke-width="1" fill="none">${[12,20,35,50,30].map((h,i)=>`<line x1="${22+i*13}" y1="${80-h}" x2="${22+i*13}" y2="80"/><circle cx="${22+i*13}" cy="${80-h}" r="1.5" fill="#a78bfa"/>`).join('')}</g><text x="14" y="22" font-family="JetBrains Mono" font-size="5" fill="#a78bfa" stroke="none">SPECTRA · 2-12μm</text>`),
    ],
    objects: [
      { name:'CRATER PROFILE', svg:tekObj('#a78bfa','CRATER · IMPCT','S-S6-A01',`
        <path d="M 20 120 L 55 120 Q 75 120 80 135 L 100 155 L 120 135 Q 125 120 145 120 L 180 120" stroke-width="1.5" fill="none"/>
        <path d="M 55 120 Q 75 120 80 135 L 100 155 L 120 135 Q 125 120 145 120" fill="#a78bfa" fill-opacity="0.12" stroke="none"/>
        <path d="M 50 112 L 55 120" stroke-width="1"/>
        <path d="M 150 112 L 145 120" stroke-width="1"/>
        <g stroke="#a78bfa" stroke-width="0.7" fill="none">
          ${Array.from({length:6},(_,i)=>`<path d="M ${30+i*8} 118 L ${28+i*8} 108" stroke-dasharray="1 1"/>`).join('')}
          ${Array.from({length:6},(_,i)=>`<path d="M ${160+i*4} 118 L ${162+i*4} 108" stroke-dasharray="1 1"/>`).join('')}
        </g>
        <g stroke="#a78bfa" stroke-width="0.5">
          <line x1="55" y1="72" x2="145" y2="72"/><line x1="55" y1="70" x2="55" y2="74"/><line x1="145" y1="70" x2="145" y2="74"/>
          <text x="86" y="66" font-family="JetBrains Mono" font-size="6" fill="#0f172a" stroke="none">D=90m</text>
        </g>
        <g stroke="#a78bfa" stroke-width="0.5">
          <line x1="160" y1="120" x2="160" y2="155"/><line x1="158" y1="120" x2="162" y2="120"/><line x1="158" y1="155" x2="162" y2="155"/>
          <text x="164" y="140" font-family="JetBrains Mono" font-size="6" fill="#0f172a" stroke="none">d=18m</text>
        </g>
        <path d="M 40 35 L 90 130" stroke="#fb923c" stroke-width="1.2" stroke-dasharray="3 2"/>
        <circle cx="40" cy="35" r="3" fill="#fb923c" stroke="none"/>
        <text x="46" y="32" font-family="JetBrains Mono" font-size="6" fill="#fb923c" stroke="none">IMPACTOR · 18 km/s</text>
      `)},
      { name:'ATMOSPHERE COLUMN', svg:tekObj('#a78bfa','ATM · PROFILE','S-S6-A02',`
        <line x1="40" y1="160" x2="40" y2="35" stroke-width="1.4"/>
        <g stroke-width="0.5" opacity="0.5">${Array.from({length:6},(_,i)=>`<line x1="38" y1="${155-i*22}" x2="42" y2="${155-i*22}"/>`).join('')}</g>
        <path d="M 40 35 L 40 158" stroke="none"/>
        <g>
          <rect x="40" y="134" width="120" height="24" fill="#a78bfa" fill-opacity="0.35" stroke="none"/>
          <rect x="40" y="108" width="120" height="26" fill="#a78bfa" fill-opacity="0.22" stroke="none"/>
          <rect x="40" y="78" width="120" height="30" fill="#a78bfa" fill-opacity="0.12" stroke="none"/>
          <rect x="40" y="48" width="120" height="30" fill="#a78bfa" fill-opacity="0.06" stroke="none"/>
        </g>
        <g stroke="#0f172a" stroke-width="0.6">
          <line x1="40" y1="134" x2="160" y2="134" stroke-dasharray="1 2"/>
          <line x1="40" y1="108" x2="160" y2="108" stroke-dasharray="1 2"/>
          <line x1="40" y1="78" x2="160" y2="78" stroke-dasharray="1 2"/>
          <line x1="40" y1="48" x2="160" y2="48" stroke-dasharray="1 2"/>
        </g>
        <g font-family="JetBrains Mono" font-size="6" fill="#0f172a" stroke="none">
          <text x="86" y="150">TROPOSPHERE · 12km</text>
          <text x="86" y="124">STRATOSPHERE · 50km</text>
          <text x="86" y="98">MESOSPHERE · 85km</text>
          <text x="86" y="68">THERMOSPHERE · 600km</text>
          <text x="14" y="38" fill="#a78bfa">h</text>
          <text x="145" y="168">—</text>
        </g>
        <path d="M 155 158 Q 100 100 155 42" stroke="#a78bfa" stroke-width="1.2" fill="none" stroke-dasharray="2 2"/>
        <text x="126" y="40" font-family="JetBrains Mono" font-size="5" fill="#a78bfa" stroke="none">ρ(h)</text>
      `)},
    ],
  },
  lfe: {
    icons: [
      tek('#34d399',`<rect x="22" y="22" width="56" height="56" rx="6" stroke-width="1.3"/><text x="36" y="54" font-family="Space Grotesk" font-weight="600" font-size="22" fill="#34d399" stroke="none">O₂</text><circle cx="70" cy="30" r="4" stroke-width="0.8" fill="#34d399" fill-opacity="0.3"/><text x="14" y="88" font-family="JetBrains Mono" font-size="5" fill="#34d399" stroke="none">21.3 kPa</text>`),
      tek('#34d399',`<path d="M 25 25 L 75 25 L 80 40 L 80 75 L 20 75 L 20 40 Z" stroke-width="1.3"/><circle cx="50" cy="55" r="14" stroke-width="1.1"/><circle cx="50" cy="55" r="5" stroke-width="1"/><path d="M 50 41 L 50 48" stroke="#34d399" stroke-width="1.5"/><g stroke="#34d399"><circle cx="32" cy="32" r="1.5" fill="#34d399"/><circle cx="68" cy="32" r="1.5" fill="#34d399"/></g>`),
      tek('#34d399',`<rect x="20" y="35" width="60" height="35" stroke-width="1.3"/><line x1="50" y1="35" x2="50" y2="70" stroke-width="0.4" stroke-dasharray="1 1"/><path d="M 30 42 Q 35 50 32 60" fill="none" stroke="#34d399" stroke-width="1"/><path d="M 40 42 Q 45 50 42 60" fill="none" stroke="#34d399" stroke-width="1"/><path d="M 60 42 Q 65 50 62 60" fill="none" stroke="#34d399" stroke-width="1"/><path d="M 70 42 Q 75 50 72 60" fill="none" stroke="#34d399" stroke-width="1"/><text x="14" y="22" font-family="JetBrains Mono" font-size="5" fill="#34d399" stroke="none">ECLSS · CO₂</text>`),
      tek('#34d399',`<path d="M 50 18 Q 35 25 35 42 Q 35 62 50 72 Q 65 62 65 42 Q 65 25 50 18 Z" stroke-width="1.3" fill="#34d399" fill-opacity="0.1"/><circle cx="44" cy="40" r="2.5" fill="#0f172a"/><circle cx="56" cy="40" r="2.5" fill="#0f172a"/><path d="M 44 52 Q 50 56 56 52" fill="none" stroke-width="1.2"/><g stroke="#34d399" stroke-width="0.8">${Array.from({length:5},(_,i)=>`<line x1="${32-i*3}" y1="${30+i*8}" x2="${28-i*3}" y2="${30+i*8}"/>`).join('')}</g>`),
    ],
    objects: [
      { name:'CREW MODULE', svg:tekObj('#34d399','CREW HAB','S-S7-A01',`
        <rect x="28" y="58" width="144" height="80" rx="20" stroke-width="1.5" fill="#fff"/>
        <line x1="28" y1="72" x2="172" y2="72" stroke-width="0.5" stroke-dasharray="2 2"/>
        <line x1="28" y1="124" x2="172" y2="124" stroke-width="0.5" stroke-dasharray="2 2"/>
        <circle cx="58" cy="98" r="9" stroke-width="1.2"/>
        <circle cx="58" cy="98" r="5" fill="#34d399" fill-opacity="0.5" stroke-width="0.6"/>
        <circle cx="100" cy="98" r="9" stroke-width="1.2"/>
        <circle cx="100" cy="98" r="5" fill="#34d399" fill-opacity="0.5" stroke-width="0.6"/>
        <circle cx="142" cy="98" r="9" stroke-width="1.2"/>
        <circle cx="142" cy="98" r="5" fill="#34d399" fill-opacity="0.5" stroke-width="0.6"/>
        <rect x="15" y="88" width="14" height="20" stroke-width="1.2"/>
        <rect x="171" y="88" width="14" height="20" stroke-width="1.2"/>
        <g font-family="JetBrains Mono" font-size="5" fill="#34d399" stroke="none">
          <text x="51" y="82">CREW 1</text>
          <text x="93" y="82">CREW 2</text>
          <text x="135" y="82">CREW 3</text>
          <text x="16" y="84">HATCH</text>
          <text x="172" y="84">HATCH</text>
        </g>
        <g stroke="#f97316" stroke-width="1" fill="none">
          ${Array.from({length:5},(_,i)=>`<path d="M ${50+i*22} 48 L ${50+i*22} 56"/><path d="M ${46+i*22} 52 L ${50+i*22} 58 L ${54+i*22} 52"/>`).join('')}
        </g>
        <text x="40" y="44" font-family="JetBrains Mono" font-size="6" fill="#f97316" stroke="none">RADIATION · 50 mSv/yr</text>
        <g stroke="#34d399" stroke-width="0.5">
          <line x1="28" y1="148" x2="172" y2="148"/><line x1="28" y1="146" x2="28" y2="150"/><line x1="172" y1="146" x2="172" y2="150"/>
          <text x="72" y="160" font-family="JetBrains Mono" font-size="6" fill="#0f172a" stroke="none">L=9.5m · Ø 3.2m</text>
        </g>
      `)},
      { name:'ECLSS LOOP', svg:tekObj('#34d399','CLSS · LOOP','S-S7-A02',`
        <rect x="30" y="42" width="44" height="26" stroke-width="1.3"/>
        <rect x="125" y="42" width="46" height="26" stroke-width="1.3"/>
        <rect x="30" y="115" width="44" height="26" stroke-width="1.3"/>
        <rect x="125" y="115" width="46" height="26" stroke-width="1.3"/>
        <circle cx="100" cy="92" r="16" stroke-width="1.3"/>
        <text x="91" y="95" font-family="Space Grotesk" font-weight="600" font-size="10" fill="#34d399" stroke="none">CM</text>
        <g stroke="#34d399" stroke-width="1.3" fill="none">
          <path d="M 74 55 L 84 92"/><path d="M 82 88 L 84 92 L 80 92"/>
          <path d="M 116 92 L 125 55"/><path d="M 123 57 L 125 55 L 121 55"/>
          <path d="M 125 128 L 116 92"/><path d="M 122 96 L 116 92 L 118 96"/>
          <path d="M 84 92 L 74 128"/><path d="M 78 124 L 74 128 L 78 128"/>
        </g>
        <g font-family="JetBrains Mono" font-size="5" fill="#0f172a" stroke="none">
          <text x="38" y="58">O₂ GEN</text>
          <text x="136" y="58">CO₂ SCRUB</text>
          <text x="34" y="131">H₂O RECLAIM</text>
          <text x="130" y="131">TEMP/HUM</text>
        </g>
        <g font-family="JetBrains Mono" font-size="5" fill="#34d399" stroke="none">
          <text x="84" y="76">O₂ 21%</text>
          <text x="108" y="76">CO₂</text>
          <text x="108" y="112">H₂O</text>
          <text x="80" y="112">WASTE</text>
        </g>
        <text x="35" y="32" font-family="JetBrains Mono" font-size="6" fill="#34d399" stroke="none">CLOSED-LOOP · 94% RECOV</text>
      `)},
    ],
  },
};

/* =================================================================
   STYLE C — SCI-FI HOLOGRAM
================================================================= */
const holo = (hue, inner) => `<svg viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#05060f"/>
  <g opacity="0.5">${Array.from({length:10},(_,i)=>`<line x1="0" y1="${i*10}" x2="100" y2="${i*10}" stroke="${hue}" stroke-width="0.3" opacity="0.12"/>`).join('')}${Array.from({length:10},(_,i)=>`<line x1="${i*10}" y1="0" x2="${i*10}" y2="100" stroke="${hue}" stroke-width="0.3" opacity="0.12"/>`).join('')}</g>
  <defs>
    <radialGradient id="hgS${hue.replace('#','')}" cx="0.5" cy="0.5" r="0.7"><stop offset="0" stop-color="${hue}" stop-opacity="0.35"/><stop offset="1" stop-color="${hue}" stop-opacity="0"/></radialGradient>
    <filter id="hfS${hue.replace('#','')}"><feGaussianBlur stdDeviation="1.2"/></filter>
  </defs>
  <rect width="100" height="100" fill="url(#hgS${hue.replace('#','')})"/>
  <g stroke="${hue}" fill="none" stroke-width="2" opacity="0.55" filter="url(#hfS${hue.replace('#','')})">${inner}</g>
  <g stroke="${hue}" fill="none" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${inner}</g>
  <g stroke="${hue}" fill="none" stroke-width="0.8" opacity="0.7">
    <path d="M 4 4 L 4 14 M 4 4 L 14 4"/>
    <path d="M 96 4 L 96 14 M 96 4 L 86 4"/>
    <path d="M 4 96 L 4 86 M 4 96 L 14 96"/>
    <path d="M 96 96 L 96 86 M 96 96 L 86 96"/>
  </g>
</svg>`;

const holoObj = (hue, label, value, inner) => `<svg viewBox="0 0 200 200">
  <rect width="200" height="200" fill="#05060f"/>
  <defs>
    <radialGradient id="hobS${label.replace(/\s/g,'')}" cx="0.5" cy="0.55" r="0.65"><stop offset="0" stop-color="${hue}" stop-opacity="0.28"/><stop offset="1" stop-color="${hue}" stop-opacity="0"/></radialGradient>
    <filter id="hofS${label.replace(/\s/g,'')}"><feGaussianBlur stdDeviation="2.2"/></filter>
    <linearGradient id="holS${label.replace(/\s/g,'')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hue}" stop-opacity="0.35"/><stop offset="1" stop-color="${hue}" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="200" height="200" fill="url(#hobS${label.replace(/\s/g,'')})"/>
  <g opacity="0.35">${Array.from({length:20},(_,i)=>`<line x1="0" y1="${i*10}" x2="200" y2="${i*10}" stroke="${hue}" stroke-width="0.3" opacity="0.15"/>`).join('')}${Array.from({length:20},(_,i)=>`<line x1="${i*10}" y1="0" x2="${i*10}" y2="200" stroke="${hue}" stroke-width="0.3" opacity="0.15"/>`).join('')}</g>

  <rect x="8" y="8" width="184" height="14" fill="url(#holS${label.replace(/\s/g,'')})" opacity="0.5"/>
  <line x1="8" y1="22" x2="192" y2="22" stroke="${hue}" stroke-width="0.8" opacity="0.5"/>
  <g font-family="JetBrains Mono, monospace" font-size="7" fill="${hue}" letter-spacing="0.2em">
    <text x="12" y="18">▸ ${label}</text>
    <text x="150" y="18" opacity="0.7">● LIVE</text>
  </g>

  <rect x="8" y="178" width="184" height="14" fill="url(#holS${label.replace(/\s/g,'')})" opacity="0.5" transform="scale(1 -1) translate(0 -370)"/>
  <line x1="8" y1="178" x2="192" y2="178" stroke="${hue}" stroke-width="0.8" opacity="0.5"/>
  <g font-family="JetBrains Mono, monospace" font-size="7" fill="${hue}" letter-spacing="0.15em">
    <text x="12" y="189">READOUT · ${value}</text>
    <text x="140" y="189" opacity="0.6">◇ SIM-07</text>
  </g>

  <g filter="url(#hofS${label.replace(/\s/g,'')})" stroke="${hue}" fill="none" stroke-width="2.5" opacity="0.55">${inner}</g>
  <g stroke="${hue}" fill="none" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${inner}</g>

  <g stroke="${hue}" fill="none" stroke-width="0.8" opacity="0.8">
    <path d="M 8 30 L 8 42 M 8 30 L 20 30"/>
    <path d="M 192 30 L 192 42 M 192 30 L 180 30"/>
    <path d="M 8 170 L 8 158 M 8 170 L 20 170"/>
    <path d="M 192 170 L 192 158 M 192 170 L 180 170"/>
  </g>
</svg>`;

const HOLOGRAM = {
  orb: {
    icons: [
      holo('#f59e0b',`<circle cx="50" cy="50" r="8"/><ellipse cx="50" cy="50" rx="36" ry="22"/><ellipse cx="50" cy="50" rx="36" ry="22" transform="rotate(60 50 50)"/><circle cx="85" cy="42" r="3"/>`),
      holo('#f59e0b',`<circle cx="50" cy="50" r="12"/><ellipse cx="50" cy="50" rx="30" ry="18" stroke-dasharray="2 2"/><ellipse cx="50" cy="50" rx="38" ry="25"/>`),
      holo('#f59e0b',`<path d="M10 55 Q 30 15 70 35 Q 90 45 90 55 Q 90 70 70 75 Q 30 85 10 55 Z"/><circle cx="50" cy="55" r="4"/>`),
      holo('#f59e0b',`<circle cx="35" cy="55" r="12"/><circle cx="75" cy="35" r="5"/><path d="M 35 55 Q 60 15 75 35" stroke-dasharray="2 2"/>`),
    ],
    objects: [
      { name:'HOHMANN', svg:holoObj('#f59e0b','HOHMANN XFER','Δv=2.9 km/s',`
        <circle cx="100" cy="92" r="8"/>
        <circle cx="100" cy="92" r="32"/>
        <circle cx="100" cy="92" r="60"/>
        <ellipse cx="86" cy="92" rx="46" ry="46" stroke-dasharray="3 2"/>
        <circle cx="68" cy="92" r="3"/><circle cx="160" cy="92" r="4"/>
        <circle cx="100" cy="92" r="70" stroke-dasharray="1 3" opacity="0.6"/>
      `)},
      { name:'KEPLER ORBIT', svg:holoObj('#f59e0b','ELLIPSE','e=0.28',`
        <ellipse cx="100" cy="92" rx="64" ry="42"/>
        <circle cx="146" cy="92" r="6"/>
        <circle cx="54" cy="92" r="2"/>
        <line x1="36" y1="92" x2="164" y2="92" stroke-dasharray="3 3" opacity="0.6"/>
        <line x1="100" y1="50" x2="100" y2="134" stroke-dasharray="3 3" opacity="0.6"/>
        <circle cx="90" cy="60" r="3"/>
        <path d="M 146 92 L 90 60"/>
      `)},
    ],
  },
  prp: {
    icons: [
      holo('#fb923c',`<path d="M40 10 L60 10 L60 60 L70 60 L50 90 L30 60 L40 60 Z"/><circle cx="50" cy="35" r="6"/>`),
      holo('#fb923c',`<rect x="25" y="38" width="50" height="24"/><rect x="20" y="42" width="10" height="16"/><path d="M 75 42 L 90 32 L 90 68 L 75 58 Z"/>`),
      holo('#fb923c',`<circle cx="50" cy="50" r="18"/><circle cx="50" cy="50" r="28" stroke-dasharray="3 2"/>`),
      holo('#fb923c',`<path d="M 30 45 Q 30 25 50 25 Q 70 25 70 45 L 70 65 L 30 65 Z"/><path d="M 35 65 L 38 85 L 42 65"/><path d="M 45 65 L 48 88 L 52 65"/><path d="M 55 65 L 58 85 L 62 65"/>`),
    ],
    objects: [
      { name:'BELL NOZZLE', svg:holoObj('#fb923c','BELL NOZZLE','ε=27 · Isp=345s',`
        <path d="M 60 30 L 140 30 L 140 60 Q 140 70 148 80 L 175 160 L 25 160 L 52 80 Q 60 70 60 60 Z"/>
        <line x1="52" y1="80" x2="148" y2="80"/>
        <circle cx="100" cy="46" r="14" stroke-dasharray="2 2" opacity="0.7"/>
        <path d="M 60 160 L 100 185 L 140 160" stroke-dasharray="3 2"/>
      `)},
      { name:'ION THRUSTER', svg:holoObj('#fb923c','ION ENGINE','Xe · 30kV · 3000s',`
        <rect x="25" y="65" width="100" height="60"/>
        ${Array.from({length:5},(_,i)=>`<circle cx="${45+i*18}" cy="95" r="4"/>`).join('')}
        <line x1="125" y1="80" x2="140" y2="80"/>
        <line x1="125" y1="110" x2="140" y2="110"/>
        <line x1="140" y1="82" x2="180" y2="82" stroke-dasharray="2 2"/>
        <line x1="140" y1="95" x2="185" y2="95"/>
        <line x1="140" y1="108" x2="180" y2="108" stroke-dasharray="2 2"/>
      `)},
    ],
  },
  lnv: {
    icons: [
      holo('#60a5fa',`<path d="M 50 10 L 58 25 L 58 70 L 42 70 L 42 25 Z"/><path d="M 42 70 L 32 85 L 42 80 Z"/><path d="M 58 70 L 68 85 L 58 80 Z"/>`),
      holo('#60a5fa',`<rect x="35" y="12" width="30" height="30"/><rect x="35" y="48" width="30" height="24"/><rect x="40" y="76" width="20" height="16"/>`),
      holo('#60a5fa',`<path d="M 50 10 L 58 22 L 52 22 L 52 72 L 48 72 L 48 22 L 42 22 Z"/><rect x="30" y="38" width="12" height="28"/><rect x="58" y="38" width="12" height="28"/>`),
      holo('#60a5fa',`<rect x="15" y="65" width="70" height="15"/><path d="M 20 65 L 35 35 L 45 35 L 30 65 Z"/><circle cx="30" cy="72" r="3"/><circle cx="70" cy="72" r="3"/>`),
    ],
    objects: [
      { name:'STAGED VEHICLE', svg:holoObj('#60a5fa','2-STAGE LV','Δv=9.8 km/s',`
        <path d="M 100 28 L 112 45 L 112 65 L 88 65 L 88 45 Z"/>
        <rect x="88" y="65" width="24" height="50"/>
        <rect x="86" y="119" width="28" height="42"/>
        <path d="M 86 161 L 78 180 L 86 176 Z"/>
        <path d="M 114 161 L 122 180 L 114 176 Z"/>
        <circle cx="100" cy="38" r="2"/>
        <path d="M 94 176 L 106 176 L 100 190 Z"/>
      `)},
      { name:'FAIRING SEP', svg:holoObj('#60a5fa','FAIRING','T+3:42 · Ø 5.2m',`
        <path d="M 100 38 L 82 65 L 68 125"/>
        <path d="M 100 38 L 118 65 L 132 125"/>
        <rect x="94" y="80" width="12" height="50"/>
        <circle cx="100" cy="95" r="5"/>
        <path d="M 82 90 L 70 84" stroke-dasharray="2 2"/>
        <path d="M 118 90 L 130 84" stroke-dasharray="2 2"/>
      `)},
    ],
  },
  str: {
    icons: [
      holo('#94a3b8',`<path d="M 20 55 Q 50 25 80 55 L 80 85 L 20 85 Z"/><path d="M 20 55 Q 50 38 80 55" stroke-dasharray="2 2"/>`),
      holo('#94a3b8',`<circle cx="50" cy="55" r="28"/><circle cx="50" cy="55" r="22" stroke-dasharray="2 2"/>`),
      holo('#94a3b8',`<rect x="20" y="40" width="60" height="6"/><rect x="20" y="48" width="60" height="6"/><rect x="20" y="56" width="60" height="6"/><rect x="20" y="64" width="60" height="6"/><rect x="20" y="72" width="60" height="6"/>`),
      holo('#94a3b8',`${Array.from({length:3},(_,r)=>Array.from({length:5},(_,i)=>`<circle cx="${20+i*15}" cy="${30+r*20}" r="6"/>`).join('')).join('')}`),
    ],
    objects: [
      { name:'HEAT SHIELD', svg:holoObj('#94a3b8','TPS','T_s=1900K',`
        <path d="M 30 122 Q 100 50 170 122"/>
        <path d="M 30 122 L 170 122"/>
        <rect x="56" y="122" width="88" height="26"/>
        ${Array.from({length:9},(_,i)=>`<path d="M ${30+i*18} 32 L ${30+i*18} 54"/>`).join('')}
      `)},
      { name:'PRESSURE HULL', svg:holoObj('#94a3b8','HULL','101 kPa · Al-Li',`
        <rect x="30" y="62" width="140" height="70" rx="30" ry="30"/>
        <circle cx="40" cy="97" r="18"/>
        <circle cx="40" cy="97" r="14" stroke-dasharray="1 1"/>
        ${Array.from({length:10},(_,i)=>{const a=i*36*Math.PI/180;return `<circle cx="${40+Math.cos(a)*18}" cy="${97+Math.sin(a)*18}" r="1.5"/>`}).join('')}
      `)},
    ],
  },
  gnc: {
    icons: [
      holo('#22d3ee',`<circle cx="50" cy="50" r="30"/><circle cx="28" cy="38" r="2"/><circle cx="68" cy="28" r="2"/><circle cx="72" cy="65" r="2"/><circle cx="34" cy="70" r="2"/>`),
      holo('#22d3ee',`<rect x="25" y="25" width="50" height="50"/><line x1="35" y1="35" x2="65" y2="65"/><line x1="65" y1="35" x2="35" y2="65"/><circle cx="50" cy="50" r="14"/>`),
      holo('#22d3ee',`<circle cx="50" cy="50" r="22"/><circle cx="50" cy="50" r="14"/><circle cx="50" cy="50" r="6"/>`),
      holo('#22d3ee',`<path d="M 15 55 L 40 55 L 50 45 L 60 55 L 85 55"/><rect x="44" y="30" width="12" height="15"/>`),
    ],
    objects: [
      { name:'STAR TRACKER', svg:holoObj('#22d3ee','STAR TRACK','± 2 arcsec',`
        <rect x="35" y="52" width="80" height="55" rx="4"/>
        <circle cx="75" cy="79" r="18"/>
        <circle cx="75" cy="79" r="22" stroke-dasharray="2 2"/>
        <path d="M 115 62 L 130 57 L 140 72 L 135 92 L 130 107 L 115 102 Z"/>
        <g stroke="#22d3ee" fill="#22d3ee"><circle cx="150" cy="52" r="1.4"/><circle cx="168" cy="92" r="1.8"/><circle cx="175" cy="75" r="1.2"/></g>
      `)},
      { name:'REACTION WHEEL', svg:holoObj('#22d3ee','RW · 3-AXIS','6000 rpm',`
        <circle cx="100" cy="94" r="42"/>
        <circle cx="100" cy="94" r="28" stroke-dasharray="2 2"/>
        <circle cx="100" cy="94" r="6"/>
        ${Array.from({length:12},(_,i)=>{const a=i*30*Math.PI/180;return `<line x1="${100+Math.cos(a)*28}" y1="${94+Math.sin(a)*28}" x2="${100+Math.cos(a)*42}" y2="${94+Math.sin(a)*42}"/>`}).join('')}
        <path d="M 100 38 A 58 58 0 0 1 144 62" stroke-dasharray="2 3"/>
      `)},
    ],
  },
  pln: {
    icons: [
      holo('#a78bfa',`<circle cx="50" cy="50" r="30"/><path d="M 22 42 Q 40 36 58 44 Q 72 52 78 46"/><circle cx="38" cy="42" r="3"/><circle cx="62" cy="58" r="4"/>`),
      holo('#a78bfa',`<path d="M 15 75 Q 30 55 40 70 Q 55 50 65 72 Q 75 55 85 75 L 85 85 L 15 85 Z"/><circle cx="30" cy="68" r="4"/><circle cx="60" cy="65" r="6"/>`),
      holo('#a78bfa',`<circle cx="50" cy="50" r="28"/><circle cx="50" cy="50" r="6"/><circle cx="42" cy="44" r="4"/><circle cx="56" cy="58" r="5"/>`),
      holo('#a78bfa',`<line x1="15" y1="80" x2="85" y2="80"/>${[12,20,35,50,30].map((h,i)=>`<line x1="${22+i*13}" y1="${80-h}" x2="${22+i*13}" y2="80"/><circle cx="${22+i*13}" cy="${80-h}" r="1.5"/>`).join('')}`),
    ],
    objects: [
      { name:'CRATER', svg:holoObj('#a78bfa','IMPACT CRATER','D=90m · d=18m',`
        <path d="M 20 122 L 55 122 Q 75 122 80 137 L 100 157 L 120 137 Q 125 122 145 122 L 180 122"/>
        <path d="M 40 42 L 90 132" stroke-dasharray="3 2"/>
        <circle cx="40" cy="42" r="3"/>
      `)},
      { name:'ATMOSPHERE', svg:holoObj('#a78bfa','ATM PROFILE','h vs ρ',`
        <line x1="40" y1="160" x2="40" y2="42"/>
        <rect x="40" y="134" width="120" height="24" fill="#a78bfa" fill-opacity="0.2"/>
        <rect x="40" y="108" width="120" height="26" fill="#a78bfa" fill-opacity="0.12"/>
        <rect x="40" y="78" width="120" height="30" fill="#a78bfa" fill-opacity="0.06"/>
        <path d="M 155 160 Q 100 100 155 50" stroke-dasharray="2 2"/>
      `)},
    ],
  },
  lfe: {
    icons: [
      holo('#34d399',`<rect x="22" y="22" width="56" height="56" rx="6"/><text x="36" y="54" font-family="Space Grotesk" font-weight="600" font-size="22" fill="#34d399" stroke="none">O₂</text>`),
      holo('#34d399',`<path d="M 25 25 L 75 25 L 80 40 L 80 75 L 20 75 L 20 40 Z"/><circle cx="50" cy="55" r="14"/><circle cx="50" cy="55" r="5"/>`),
      holo('#34d399',`<rect x="20" y="35" width="60" height="35"/><path d="M 30 42 Q 35 50 32 60"/><path d="M 40 42 Q 45 50 42 60"/><path d="M 60 42 Q 65 50 62 60"/><path d="M 70 42 Q 75 50 72 60"/>`),
      holo('#34d399',`<path d="M 50 18 Q 35 25 35 42 Q 35 62 50 72 Q 65 62 65 42 Q 65 25 50 18 Z"/><circle cx="44" cy="40" r="2" fill="#34d399"/><circle cx="56" cy="40" r="2" fill="#34d399"/>`),
    ],
    objects: [
      { name:'CREW MODULE', svg:holoObj('#34d399','CREW HAB','3 crew · 9.5m',`
        <rect x="28" y="60" width="144" height="80" rx="20"/>
        <circle cx="58" cy="100" r="9"/>
        <circle cx="100" cy="100" r="9"/>
        <circle cx="142" cy="100" r="9"/>
        <rect x="15" y="90" width="14" height="20"/>
        <rect x="171" y="90" width="14" height="20"/>
      `)},
      { name:'ECLSS LOOP', svg:holoObj('#34d399','CLSS','94% recov',`
        <rect x="30" y="44" width="44" height="26"/>
        <rect x="125" y="44" width="46" height="26"/>
        <rect x="30" y="117" width="44" height="26"/>
        <rect x="125" y="117" width="46" height="26"/>
        <circle cx="100" cy="94" r="16"/>
        <path d="M 74 57 L 84 94" stroke-dasharray="2 2"/>
        <path d="M 116 94 L 125 57" stroke-dasharray="2 2"/>
        <path d="M 125 130 L 116 94" stroke-dasharray="2 2"/>
        <path d="M 84 94 L 74 130" stroke-dasharray="2 2"/>
      `)},
    ],
  },
};

/* =================================================================
   STYLE B — DARK EDITORIAL (reuse same inner geometries on near-black)
================================================================= */
const drk = (hue, inner) => `<svg viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#0a0a0a"/>
  <rect width="100" height="100" fill="${hue}" fill-opacity="0.05"/>
  <g stroke="${hue}" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${inner}</g>
</svg>`;

const drkObj = (hue, label, value, inner) => `<svg viewBox="0 0 200 200">
  <rect width="200" height="200" fill="#0a0a0a"/>
  <rect width="200" height="200" fill="${hue}" fill-opacity="0.03"/>
  <line x1="20" y1="24" x2="180" y2="24" stroke="${hue}" stroke-width="0.5" opacity="0.4"/>
  <line x1="20" y1="176" x2="180" y2="176" stroke="${hue}" stroke-width="0.5" opacity="0.4"/>
  <g font-family="'JetBrains Mono', monospace" font-size="7" letter-spacing="0.24em" fill="${hue}">
    <text x="20" y="18">${label}</text>
    <text x="20" y="192" opacity="0.7">${value}</text>
  </g>
  <circle cx="180" cy="15" r="2.5" fill="${hue}"/>
  <g stroke="${hue}" fill="none" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${inner}</g>
</svg>`;

function extractInner(svgString) {
  const regex = /<g\s+stroke="[^"]+"\s+fill="none"\s+stroke-width="1\.[23]"[^>]*>([\s\S]*?)<\/g>(?=\s*<g[^>]*stroke-width="0\.8"|\s*<\/svg>|\s*$)/g;
  const matches = [...svgString.matchAll(regex)];
  if (matches.length) return matches[matches.length - 1][1];
  return '';
}

const DARK = {};
Object.keys(TECHNICAL).forEach(k => {
  const sub = SPACE_SUBS.find(s => s.id === k);
  const t = TECHNICAL[k];
  const h = HOLOGRAM[k];
  DARK[k] = {
    icons: h.icons.map(s => drk(sub.hue, extractInner(s))),
    objects: h.objects.map((o, i) => ({
      name: t.objects[i].name,
      svg: drkObj(sub.hue, t.objects[i].name, sub.formula.split('·')[0].trim(), extractInner(o.svg))
    })),
  };
});

// =====================================================================
window.SPACE_VIVID = {
  subs: SPACE_SUBS,
  styles: {
    tech: { name:'Technical Blueprint', data: TECHNICAL },
    dark: { name:'Dark Editorial',      data: DARK     },
    holo: { name:'Sci-Fi Hologram',     data: HOLOGRAM },
  },
};

})();
