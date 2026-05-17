/* Homepage — the public/landing view */
function Homepage({ go }) {
  return (
    <main className="page" style={{paddingTop: 14}}>
      {/* Hero */}
      <section style={{
        position:"relative", overflow:"hidden",
        border:"1px solid var(--border)", borderRadius: 16,
        background:"linear-gradient(135deg, #FFFFFF 0%, #FBF8F1 55%, #F1E8D6 100%)",
        padding: "44px 48px 44px",
        marginBottom: 16,
        boxShadow: "var(--shadow-sm)"
      }}>
        <div style={{
          position:"absolute", top: 18, right: 22,
          fontFamily:"var(--mono)", fontSize:11, color:"var(--sub)",
          display:"flex", alignItems:"center", gap:8
        }}>
          <span style={{display:"inline-block", width:7, height:7, borderRadius:999, background:"var(--violet)"}}/>
          v2.4
        </div>

        <div style={{display:"grid", gridTemplateColumns: "1.15fr 1fr", gap: 48, alignItems:"center"}}>
          <div>
            <div className="eyebrow" style={{marginBottom: 22}}>
              <span className="dot"/> For builders aged 10–14
            </div>
            <h1 className="display" style={{maxWidth: 640}}>
              <span style={{color:"var(--primary)"}}>Fork</span> a real project.<br/>
              <span style={{color:"var(--aerospace)"}}>Ship</span> it for real.
            </h1>

            <p style={{
              maxWidth: 500, marginTop: 20,
              fontSize: 15, lineHeight: 1.55, color: "var(--sub)"
            }}>
              Industry-grade STEAM projects packaged as forkable repos. An AI agent fills the gap whenever the work outpaces the syllabus.
            </p>

            <div style={{display:"flex", gap:10, marginTop: 26}}>
              <button className="btn btn-violet btn-lg" onClick={()=>go("library")}>
                Browse library <Icon name="arrow-right" size={15}/>
              </button>
              <button className="btn btn-ghost btn-lg" onClick={()=>go("dashboard")}>
                My dashboard
              </button>
            </div>
          </div>

          <div>
            <PackageVisual />
          </div>
        </div>
      </section>

      {/* Three-up */}
      <section style={{display:"grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 18}}>
        <ValueCell n="01" t="Industry scope"    icon="target"     c="primary"
          body="Real parts, real datasheets, real failure modes."/>
        <ValueCell n="02" t="AI fills the gap"  icon="bot"        c="computing"
          body="When the math goes past 6th grade, the agent picks it up."/>
        <ValueCell n="03" t="Repo, not a course"icon="git-branch" c="bio"
          body="Fork it. Ship it. Open a PR when you're done."/>
      </section>

      {/* Featured projects */}
      <section style={{marginTop: 32}}>
        <SectionRule eyebrow="Featured"
          title="In the library"
          right={<button className="btn btn-ghost btn-sm" onClick={()=>go("library")}>All 124 <Icon name="arrow-right" size={13}/></button>}
        />
        <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap: 12, marginTop: 16}}>
          <FeaturedCard
            cover="climate"
            title="PurpleAir / OpenAQ 空气质量节点"
            slug="purpleair-airquality-node"
            tag="Climate"
            weeks={26}
            forks={1840}
            difficulty={3}
            color="climate"
            blurb="Run EPA NowCast on your own PM2.5. Cross-validate against an EPA station 5km away."
            onOpen={()=>go("project")}
          />
          <FeaturedCard
            cover="space"
            title="437.4 MHz cubesat 地面站"
            slug="cubesat-groundstation"
            tag="Aerospace"
            weeks={18}
            forks={612}
            difficulty={4}
            color="aerospace"
            blurb="Build a UHF Yagi, decode AX.25 from amateur sats, upload to SatNOGS."
          />
          <FeaturedCard
            cover="bio"
            title="家用微塑料目视计数管线"
            slug="microplastic-counter"
            tag="Bioscience"
            weeks={12}
            forks={948}
            difficulty={3}
            color="bio"
            blurb="Microscope + OpenCV. Count microplastics from tea, salt, tap water."
          />
        </div>
      </section>

      {/* How it works */}
      <section style={{marginTop: 48}}>
        <SectionRule eyebrow="The loop" title="How a project lives" />
        <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap: 0, marginTop: 18, border: "1px solid var(--border)", borderRadius: 12, overflow:"hidden", background:"var(--card)"}}>
          <Step n="01" icon="git-fork" t="Fork"  body="Clone a project with its module ladder and BOM."/>
          <Step n="02" icon="bot"      t="Learn" body="Short modules. AI agent on standby for the hard parts."/>
          <Step n="03" icon="circuit"  t="Build" body="Solder, flash, wire, mount. Real hardware, real failures."/>
          <Step n="04" icon="rocket"   t="Ship"  body="Submit upstream. Open a PR back to the library." last/>
        </div>
      </section>

      {/* Metrics strip */}
      <section style={{marginTop: 32, display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12}}>
        <Stat n="124"    l="projects" sub="8 domains" c="var(--primary)"/>
        <Stat n="38,402" l="modules done" sub="last 30 days" c="var(--aerospace)"/>
        <Stat n="2,116"  l="hardware ships" sub="all cohorts" c="var(--bio)"/>
        <Stat n="64%"    l="cross-validated upstream" sub="on submission" c="var(--robotics)"/>
      </section>

      {/* Footer */}
      <footer style={{marginTop: 64, paddingTop: 28, borderTop: "1px solid var(--border)", display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap: 32, color:"var(--sub)", fontSize:13}}>
        <div>
          <div className="brand" style={{marginBottom: 10}}>
            <span className="brand-mark"><span>SE</span></span>
            <span style={{color:"var(--ink)", fontWeight:600}}>SystemEdu</span>
          </div>
          <div className="mono" style={{marginTop:14, color:"var(--sub-2)", fontSize:11}}>© 2026 SystemEdu Labs</div>
        </div>
        <FootCol t="Library"  items={["Climate","Aerospace","Bioscience","Robotics"]}/>
        <FootCol t="Platform" items={["Knowledge tree","AI tutor","Hardware kits"]}/>
        <FootCol t="Company"  items={["About","Open source","Careers"]}/>
      </footer>
    </main>
  );
}

function SectionRule({ eyebrow, title, right }) {
  return (
    <div style={{display:"flex", alignItems:"flex-end", justifyContent:"space-between", paddingBottom: 12, borderBottom: "1px solid var(--border)"}}>
      <div>
        <div className="eyebrow" style={{marginBottom: 6}}><span className="dot"/> {eyebrow}</div>
        <h2 style={{fontSize: 22, fontWeight:600, letterSpacing:"-.025em"}}>{title}</h2>
      </div>
      {right}
    </div>
  );
}

/* Simple value cell with a colorful icon — restored from sci-fi experiment */
function ValueCell({ n, t, body, icon, c }) {
  const palette = {
    primary:   { tint:"var(--primary)",   soft:"var(--primary-soft)" },
    aerospace: { tint:"var(--aerospace)", soft:"var(--aerospace-soft)" },
    bio:       { tint:"var(--bio)",       soft:"var(--bio-soft)" },
    robotics:  { tint:"var(--robotics)",  soft:"var(--robotics-soft)" },
    computing: { tint:"var(--computing)", soft:"var(--computing-soft)" },
    climate:   { tint:"var(--climate)",   soft:"var(--climate-soft)" },
  };
  const p = palette[c] || palette.primary;
  return (
    <div className="card" style={{padding: 20, position:"relative", overflow:"hidden"}}>
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: 16}}>
        <div className="mono" style={{color: p.tint, fontWeight:500, fontSize:11}}>{n}</div>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: p.soft, display:"grid", placeItems:"center",
          color: p.tint
        }}>
          <Icon name={icon} size={16}/>
        </div>
      </div>
      <h3 className="h2" style={{marginBottom: 6, fontSize:17}}>{t}</h3>
      <p className="body" style={{maxWidth: 340, fontSize: 13.5, color: "var(--sub)"}}>{body}</p>
    </div>
  );
}

/* Sci-fi feature blocks — kept available but no longer used on homepage */
function FeatureBlock({ kind }) {
  if (kind === "scope") return <FBScope/>;
  if (kind === "agent") return <FBAgent/>;
  if (kind === "repo")  return <FBRepo/>;
  return null;
}

/* ── 01 — INDUSTRY SCOPE ── blueprint schematic of a PMS5003 sensor */
function FBScope() {
  return (
    <div className="fb fb--scope">
      <div className="fb__chrome">
        <span className="fb__index">01 / SCOPE</span>
        <span className="fb__pulse"/>
      </div>
      <div className="fb__viz">
        <svg viewBox="0 0 320 180" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          {/* grid */}
          <defs>
            <pattern id="bp-grid" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M16 0 L0 0 0 16" fill="none" stroke="#1B3679" strokeOpacity=".35" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="320" height="180" fill="url(#bp-grid)"/>

          {/* Sensor body */}
          <g transform="translate(96, 50)">
            <rect width="130" height="78" rx="3" fill="#0E1E48" stroke="#7FAEFF" strokeWidth="1.2"/>
            {/* inlet circle */}
            <circle cx="32" cy="38" r="14" fill="none" stroke="#7FAEFF" strokeWidth="1.2"/>
            <circle cx="32" cy="38" r="6"  fill="none" stroke="#7FAEFF" strokeWidth="0.8"/>
            <circle cx="32" cy="38" r="1.6" fill="#7FAEFF"/>
            {/* fan grille */}
            {[58, 70, 82, 94, 106].map((x,i)=>(
              <line key={i} x1={x} y1="20" x2={x} y2="56" stroke="#7FAEFF" strokeWidth=".7"/>
            ))}
            {/* pins */}
            {[0,1,2,3,4,5,6,7].map(i => (
              <rect key={i} x={6+i*16} y="78" width="6" height="4" fill="#7FAEFF"/>
            ))}
            {/* part label */}
            <text x="65" y="72" textAnchor="middle" fontFamily="Geist Mono" fontSize="8" fill="#9EC0FF" letterSpacing="0.05em">PMS5003 · LASER</text>
          </g>

          {/* dimension callout */}
          <g stroke="#7FAEFF" strokeWidth=".6" fill="none">
            <line x1="96" y1="38" x2="78" y2="38"/>
            <line x1="76" y1="34" x2="76" y2="42"/>
            <line x1="78" y1="38" x2="78" y2="22"/>
            <line x1="226" y1="38" x2="244" y2="38"/>
            <line x1="246" y1="34" x2="246" y2="42"/>
          </g>
          <text x="62" y="20" fontFamily="Geist Mono" fontSize="8" fill="#9EC0FF">A · INLET</text>
          <text x="248" y="42" fontFamily="Geist Mono" fontSize="8" fill="#9EC0FF">B · UART</text>

          {/* corner ticks */}
          {[[8,8],[312,8],[8,172],[312,172]].map(([x,y],i)=>(
            <g key={i} stroke="#7FAEFF" strokeWidth="0.8">
              <line x1={x-4} y1={y} x2={x+4} y2={y}/>
              <line x1={x} y1={y-4} x2={x} y2={y+4}/>
            </g>
          ))}

          {/* sweeping scan line */}
          <line className="fb-scan" x1="0" x2="320" y1="0" y2="0" stroke="#7FAEFF" strokeOpacity=".55" strokeWidth="1"/>
        </svg>
      </div>
      <div className="fb__body">
        <h3 className="fb__title">Industry-grade scope</h3>
        <p className="fb__copy">Real parts. Real datasheets. Real failure modes — drop-in compatible with the networks that grown-ups use.</p>
      </div>
    </div>
  );
}

/* ── 02 — AI FILLS THE GAP ── neural graph with a bridged gap */
function FBAgent() {
  return (
    <div className="fb fb--agent">
      <div className="fb__chrome">
        <span className="fb__index">02 / AGENT</span>
        <span className="fb__pulse fb__pulse--magenta"/>
      </div>
      <div className="fb__viz">
        <svg viewBox="0 0 320 180" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          {/* glow */}
          <defs>
            <radialGradient id="ag-glow" cx="50%" cy="50%" r="55%">
              <stop offset="0%"  stopColor="#FF6FB3" stopOpacity=".5"/>
              <stop offset="60%" stopColor="#FF6FB3" stopOpacity="0"/>
            </radialGradient>
          </defs>
          <rect width="320" height="180" fill="url(#ag-glow)" opacity=".55"/>

          {/* left cluster of "mastered" nodes */}
          {[[28,40],[44,72],[28,108],[58,128],[60,46]].map(([x,y],i)=>(
            <g key={"L"+i}>
              <circle cx={x} cy={y} r="3.4" fill="#FFFFFF" opacity=".9"/>
              <circle cx={x} cy={y} r="7" fill="none" stroke="#FFFFFF" strokeOpacity=".3"/>
            </g>
          ))}
          {/* right cluster (target) */}
          {[[280,40],[260,72],[280,108],[250,128],[256,46]].map(([x,y],i)=>(
            <g key={"R"+i}>
              <circle cx={x} cy={y} r="3.4" fill="#FFFFFF" opacity=".7"/>
              <circle cx={x} cy={y} r="7" fill="none" stroke="#FFFFFF" strokeOpacity=".25"/>
            </g>
          ))}

          {/* left -> bridge */}
          <g stroke="#FFE7F3" strokeWidth=".8" strokeOpacity=".6">
            <path d="M28 40 Q90 30 130 80"/>
            <path d="M44 72 Q90 80 130 80"/>
            <path d="M28 108 Q80 110 130 100"/>
            <path d="M58 128 Q100 120 130 100"/>
          </g>
          {/* right -> bridge */}
          <g stroke="#FFE7F3" strokeWidth=".8" strokeOpacity=".6">
            <path d="M280 40 Q230 28 190 80"/>
            <path d="M260 72 Q220 78 190 80"/>
            <path d="M280 108 Q230 112 190 100"/>
            <path d="M250 128 Q210 118 190 100"/>
          </g>

          {/* the "gap" — agent bridge */}
          <g>
            <rect x="130" y="74" width="60" height="32" rx="6"
              fill="rgba(255,255,255,.08)" stroke="#FFFFFF" strokeWidth="1"/>
            <text x="160" y="94" textAnchor="middle" fontFamily="Geist Mono" fontSize="9.5"
              fill="#FFFFFF" letterSpacing="0.08em">AGENT</text>
          </g>

          {/* data packets — animated */}
          <circle r="2.4" fill="#FFFFFF">
            <animateMotion dur="2.2s" repeatCount="indefinite" path="M28 40 Q90 30 130 80 L160 90 Q200 100 280 108"/>
          </circle>
          <circle r="2.4" fill="#FFFFFF">
            <animateMotion dur="2.6s" begin=".4s" repeatCount="indefinite" path="M44 72 Q90 80 130 80 L160 90 Q200 100 260 72"/>
          </circle>
          <circle r="2.4" fill="#FFFFFF">
            <animateMotion dur="2.4s" begin=".8s" repeatCount="indefinite" path="M28 108 Q80 110 130 100 L160 90 Q200 100 280 40"/>
          </circle>

          {/* gap label brackets */}
          <g stroke="#FFFFFF" strokeWidth=".6" strokeOpacity=".4">
            <line x1="128" y1="58" x2="128" y2="64"/>
            <line x1="128" y1="58" x2="192" y2="58"/>
            <line x1="192" y1="58" x2="192" y2="64"/>
          </g>
          <text x="160" y="54" textAnchor="middle" fontFamily="Geist Mono" fontSize="8.5" fill="#FFFFFF" opacity=".65">KNOWLEDGE GAP</text>
        </svg>
      </div>
      <div className="fb__body">
        <h3 className="fb__title">AI fills the gap</h3>
        <p className="fb__copy">When a project needs concepts past 6th grade, an agent picks them up in real time — never moves on without you.</p>
      </div>
    </div>
  );
}

/* ── 03 — REPO, NOT A COURSE ── terminal */
function FBRepo() {
  const lines = [
    { p:"$", t:" se fork purpleair-airquality-node", soft:false },
    { p:"›", t:" cloning 30 modules · 56 concepts · 26 wk", soft:true  },
    { p:"›", t:" wiring knowledge tree …", soft:true },
    { p:"✓", t:" ready · run `se learn` to begin", soft:false, ok:true },
  ];
  return (
    <div className="fb fb--repo">
      <div className="fb__chrome">
        <span className="fb__index">03 / REPO</span>
        <span className="fb__pulse fb__pulse--green"/>
      </div>
      <div className="fb__viz fb__viz--term">
        <div className="fb-term__bar">
          <span style={{width:7,height:7,borderRadius:999,background:"#FF5F57"}}/>
          <span style={{width:7,height:7,borderRadius:999,background:"#FEBC2E"}}/>
          <span style={{width:7,height:7,borderRadius:999,background:"#28C840"}}/>
          <span className="fb-term__title">systemedu — fork</span>
        </div>
        <div className="fb-term__body">
          {lines.map((l, i)=>(
            <div key={i} className={"fb-term__line " + (l.ok?"is-ok":l.soft?"is-soft":"")}>
              <span className="fb-term__p">{l.p}</span>{l.t}
            </div>
          ))}
          <div className="fb-term__line"><span className="fb-term__p">$</span> <span className="fb-term__cursor"/></div>
        </div>
      </div>
      <div className="fb__body">
        <h3 className="fb__title">A repo, not a course</h3>
        <p className="fb__copy">Fork. Branch. Pull request. Every project lives on disk as a real engineering tree — learn the workflow while you learn the work.</p>
      </div>
    </div>
  );
}

function FeaturedCard({ title, slug, tag, weeks, forks, difficulty, color, blurb, cover, onOpen }) {
  const tagClass = "tag " + color;
  return (
    <div className="card" style={{padding: 0, overflow:"hidden", display:"flex", flexDirection:"column", cursor: onOpen ? "pointer" : "default"}}
         onClick={onOpen}>
      <CoverArt kind={cover} />
      <div style={{padding: 18, display:"flex", flexDirection:"column", gap: 12, flex: 1}}>
        <div style={{display:"flex", gap: 6, alignItems:"center"}}>
          <span className={tagClass}>{tag}</span>
          <span className="tag">{weeks}w</span>
          <span className="tag">diff {difficulty}/10</span>
        </div>
        <div className="mono" style={{color:"var(--sub-2)", fontSize: 11}}>{slug}</div>
        <h3 className="h3" style={{fontSize: 16.5, lineHeight:1.35}}>{title}</h3>
        <p className="body" style={{fontSize: 13.5, color: "var(--sub)"}}>{blurb}</p>
        <div style={{flex:1}}/>
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", paddingTop: 12, borderTop: "1px dashed var(--border)"}}>
          <span className="mono" style={{fontSize: 11.5, color:"var(--sub)", display:"inline-flex", alignItems:"center", gap:6}}>
            <Icon name="git-fork" size={12}/>{forks.toLocaleString()} forks
          </span>
          <span style={{color:"var(--violet)", fontSize:13, fontWeight:500, display:"inline-flex", alignItems:"center", gap:4}}>
            Open <Icon name="arrow-right" size={13}/>
          </span>
        </div>
      </div>
    </div>
  );
}

/* Decorative covers — no AI slop, just CSS shapes */
function CoverArt({ kind }) {
  if (kind === "climate") return (
    <div style={{height: 168, background:"linear-gradient(180deg, #F8EDE5 0%, #FBF9FF 100%)", position:"relative", overflow:"hidden", borderBottom:"1px solid var(--border)"}}>
      {/* AQI waveform */}
      <svg viewBox="0 0 320 168" width="100%" height="100%" preserveAspectRatio="none" style={{position:"absolute", inset:0}}>
        <defs>
          <linearGradient id="aqg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#D97757" stopOpacity=".25"/>
            <stop offset="1" stopColor="#D97757" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {[40,80,120].map((y,i)=>(
          <line key={i} x1="0" x2="320" y1={y} y2={y} stroke="#ECCFB8" strokeDasharray="2 4"/>
        ))}
        <path d="M0 110 L30 95 L60 100 L90 80 L120 70 L150 55 L180 65 L210 45 L240 50 L270 35 L300 40 L320 30 L320 168 L0 168 Z" fill="url(#aqg)"/>
        <path d="M0 110 L30 95 L60 100 L90 80 L120 70 L150 55 L180 65 L210 45 L240 50 L270 35 L300 40 L320 30" fill="none" stroke="#D97757" strokeWidth="1.5"/>
        {[[30,95],[90,80],[150,55],[210,45],[270,35]].map(([x,y],i)=>(
          <circle key={i} cx={x} cy={y} r="2.5" fill="#D97757"/>
        ))}
      </svg>
      <div style={{position:"absolute", top: 14, left: 16, display:"flex", gap:6, alignItems:"center"}}>
        <Icon name="wind" size={16} style={{color:"var(--violet-ink)"}}/>
        <span style={{fontFamily:"var(--mono)", fontSize:11, color:"var(--violet-ink)", fontWeight:500}}>PM2.5 · μg/m³ · live</span>
      </div>
      <div style={{position:"absolute", bottom: 12, right: 16, fontFamily:"var(--mono)", fontSize:24, color:"var(--violet-ink)", fontWeight:600}}>
        AQI 47
      </div>
    </div>
  );
  if (kind === "space") return (
    <div style={{height: 168, background:"#15131F", position:"relative", overflow:"hidden", borderBottom:"1px solid var(--border)"}}>
      <svg viewBox="0 0 320 168" width="100%" height="100%" preserveAspectRatio="none">
        {Array.from({length: 40}).map((_,i)=>{
          const x = (i*37)%320, y = (i*23)%168, r = (i%7===0)?1.5:0.8;
          return <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity={r===1.5?.9:.4}/>;
        })}
        <ellipse cx="240" cy="60" rx="55" ry="55" fill="none" stroke="#D97757" strokeOpacity=".5" strokeWidth="1"/>
        <ellipse cx="240" cy="60" rx="38" ry="38" fill="none" stroke="#D97757" strokeOpacity=".7" strokeWidth="1"/>
        <circle cx="240" cy="60" r="14" fill="#D97757" opacity=".15"/>
        <circle cx="240" cy="60" r="3" fill="#D97757"/>
        <path d="M30 140 L80 110 L100 130 L160 80" stroke="#D97757" strokeWidth="1.2" fill="none"/>
        <path d="M30 140 l-3 -3 m6 0 l-3 3" stroke="#D97757" strokeWidth="1.2"/>
      </svg>
      <div style={{position:"absolute", top: 14, left: 16, display:"flex", gap:6, alignItems:"center"}}>
        <Icon name="antenna" size={16} style={{color:"#EFC8AC"}}/>
        <span style={{fontFamily:"var(--mono)", fontSize:11, color:"#EFC8AC"}}>437.405 MHz · AOS</span>
      </div>
      <div style={{position:"absolute", bottom: 12, right: 16, fontFamily:"var(--mono)", fontSize: 11, color:"#EFC8AC", textAlign:"right", lineHeight:1.4}}>
        ISS / SO-50<br/>elev 38°
      </div>
    </div>
  );
  if (kind === "bio") return (
    <div style={{height: 168, background:"#EFEBDD", position:"relative", overflow:"hidden", borderBottom:"1px solid var(--border)"}}>
      <svg viewBox="0 0 320 168" width="100%" height="100%" preserveAspectRatio="none">
        <circle cx="160" cy="84" r="74" fill="none" stroke="#A67B5B" strokeOpacity=".25"/>
        <circle cx="160" cy="84" r="55" fill="none" stroke="#A67B5B" strokeOpacity=".4"/>
        {[
          [120,60,5],[145,75,3],[170,55,4],[180,90,6],[150,100,3.5],
          [135,90,2.5],[195,75,4],[205,95,2.5],[125,105,4],[175,115,3]
        ].map(([x,y,r],i)=>(
          <g key={i}>
            <circle cx={x} cy={y} r={r} fill="#A67B5B" opacity=".15"/>
            <circle cx={x} cy={y} r={r} fill="none" stroke="#A67B5B" strokeWidth="0.8"/>
          </g>
        ))}
        <line x1="160" y1="84" x2="220" y2="50" stroke="#5E412A" strokeWidth="0.6"/>
      </svg>
      <div style={{position:"absolute", top: 14, left: 16, display:"flex", gap:6, alignItems:"center"}}>
        <Icon name="flask" size={16} style={{color:"#5E412A"}}/>
        <span style={{fontFamily:"var(--mono)", fontSize:11, color:"#5E412A"}}>field 4 · 40× · n=23</span>
      </div>
      <div style={{position:"absolute", bottom: 12, right: 16, fontFamily:"var(--mono)", fontSize: 11, color:"#5E412A"}}>
        ø 5–80 μm
      </div>
    </div>
  );
  return <Stripes height={168} label="cover"/>;
}

function Step({ n, icon, t, body, last }) {
  return (
    <div style={{padding: 22, borderRight: last ? "0" : "1px solid var(--border)", display:"flex", flexDirection:"column", gap: 14, minHeight: 200}}>
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
        <span className="mono" style={{color:"var(--sub-2)"}}>{n}</span>
        <Icon name={icon} size={18} style={{color:"var(--violet)"}}/>
      </div>
      <h4 className="h3" style={{fontSize:15}}>{t}</h4>
      <p className="body" style={{fontSize: 13.5}}>{body}</p>
    </div>
  );
}

function Stat({ n, l, sub, c }) {
  return (
    <div style={{padding: "16px 18px", border:"1px solid var(--border)", borderRadius: 10, background:"var(--card)"}}>
      <div style={{fontSize: 36, lineHeight:1, letterSpacing:"-.035em", color: c || "var(--primary)", fontWeight:600}}>{n}</div>
      <div style={{marginTop: 8, fontSize: 13, color:"var(--ink-2)"}}>{l}</div>
      <div className="mono" style={{marginTop: 3, fontSize: 11, color:"var(--sub)"}}>{sub}</div>
    </div>
  );
}

function FootCol({ t, items }) {
  return (
    <div>
      <div style={{color: "var(--ink)", fontWeight:600, fontSize:13, marginBottom:12}}>{t}</div>
      <ul style={{listStyle:"none", padding:0, margin:0, display:"flex", flexDirection:"column", gap: 7}}>
        {items.map((i,k)=>(<li key={k} style={{fontSize:13, color:"var(--sub)"}}>{i}</li>))}
      </ul>
    </div>
  );
}

/* Package visual — a stylized repo card */
function PackageVisual() {
  return (
    <div style={{
      position:"relative",
      border:"1px solid var(--border)",
      borderRadius: 12,
      padding: 18,
      background: "var(--paper)",
      boxShadow: "0 1px 0 rgba(0,0,0,.02), 0 12px 24px -16px rgba(0,0,0,.12)"
    }}>
      <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:14}}>
        <Icon name="git-branch" size={15} style={{color:"var(--violet)"}}/>
        <span className="mono" style={{fontSize:12}}>systemedu/projects</span>
        <span className="tag violet" style={{marginLeft:"auto"}}>v1.4.2</span>
      </div>
      <div style={{fontSize: 18, letterSpacing:"-.02em", lineHeight:1.2, fontWeight:600}}>
        purpleair-airquality-node
      </div>
      <div className="sub" style={{marginTop: 4, marginBottom: 14, fontSize: 12.5}}>
        EPA NowCast · Raspberry Pi · PMS5003
      </div>

      {/* file tree */}
      <div className="mono" style={{
        fontSize: 12, lineHeight: 1.8,
        background: "#fff", border:"1px solid var(--border)", borderRadius: 8,
        padding: "10px 12px"
      }}>
        <div style={{color:"var(--sub-2)"}}>├── README.md</div>
        <div style={{color:"var(--sub-2)"}}>├── hardware/</div>
        <div style={{color:"var(--sub-2)"}}>│   ├── BOM.csv</div>
        <div style={{color:"var(--ink-2)"}}>│   └── enclosure.step</div>
        <div style={{color:"var(--ink-2)"}}>├── firmware/pms5003_uart.py</div>
        <div style={{color:"var(--ink-2)"}}>├── calibration/epa_nowcast.py</div>
        <div style={{color:"var(--violet)"}}>└── knowledge.tree.json</div>
      </div>

      <div style={{display:"flex", gap: 8, marginTop: 14}}>
        <button className="btn btn-violet btn-sm" style={{flex:1, justifyContent:"center"}}>
          <Icon name="git-fork" size={13}/> Fork this project
        </button>
        <button className="btn btn-ghost btn-sm">
          <Icon name="bookmark" size={13}/>
        </button>
      </div>

      <div style={{display:"flex", gap: 14, marginTop: 14, fontSize:11, color:"var(--sub)", fontFamily:"var(--mono)"}}>
        <span><Icon name="star" size={11} style={{verticalAlign:-1}}/> 4.8k</span>
        <span><Icon name="git-fork" size={11} style={{verticalAlign:-1}}/> 1,840</span>
        <span><Icon name="users" size={11} style={{verticalAlign:-1}}/> 712 active</span>
      </div>
    </div>
  );
}

window.Homepage = Homepage;
window.CoverArt = CoverArt;
window.SectionRule = SectionRule;
