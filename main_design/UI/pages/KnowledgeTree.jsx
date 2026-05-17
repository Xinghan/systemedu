/* KnowledgeTree — interactive concept graph (renders as a modal) */
function KnowledgeTree({ go, project, onClose }) {
  // Nodes organized by section column. (x, y are layout coords in viewport units.)
  // status: mastered | active | available | locked
  // kind: concept | skill | tool | standard
  const NODES = useMemo(() => [
    // S1 — concepts
    { id:"air",       s:"S1", x: 80, y: 120, t:"空气成分", k:"concept",  status:"mastered" },
    { id:"pm25",      s:"S1", x: 80, y: 200, t:"PM2.5 / PM10", k:"concept", status:"mastered" },
    { id:"health",    s:"S1", x: 80, y: 280, t:"健康暴露", k:"concept", status:"mastered" },
    { id:"aqi",       s:"S1", x: 80, y: 360, t:"AQI 指数", k:"standard", status:"mastered" },
    { id:"networks",  s:"S1", x: 80, y: 440, t:"PurpleAir / OpenAQ / EPA", k:"concept", status:"mastered" },

    // S2 — linux / electronics
    { id:"linux",     s:"S2", x: 260, y: 140, t:"Linux 基础", k:"skill", status:"mastered" },
    { id:"ssh",       s:"S2", x: 260, y: 220, t:"SSH", k:"skill", status:"mastered" },
    { id:"voltage",   s:"S2", x: 260, y: 300, t:"电压 / 电流", k:"concept", status:"mastered" },
    { id:"solder",    s:"S2", x: 260, y: 380, t:"焊接", k:"skill", status:"mastered" },
    { id:"levelshift",s:"S2", x: 260, y: 460, t:"电平转换", k:"concept", status:"mastered" },

    // S3 — sensors (mostly mastered, M14 = current)
    { id:"laser",     s:"S3", x: 440, y: 100, t:"激光散射", k:"concept", status:"mastered" },
    { id:"uart",      s:"S3", x: 440, y: 180, t:"UART 串口", k:"skill", status:"mastered" },
    { id:"pms5003",   s:"S3", x: 440, y: 260, t:"PMS5003", k:"tool", status:"mastered" },
    { id:"i2c",       s:"S3", x: 440, y: 340, t:"I²C 协议", k:"skill", status:"mastered" },
    { id:"bme280",    s:"S3", x: 440, y: 420, t:"BME280", k:"tool", status:"mastered" },
    { id:"redundancy",s:"S3", x: 440, y: 500, t:"传感器冗余", k:"concept", status:"mastered" },
    { id:"stevenson", s:"S3", x: 540, y: 260, t:"Stevenson screen", k:"concept", status:"active" },
    { id:"drift",     s:"S3", x: 540, y: 340, t:"温度漂移", k:"concept", status:"active" },
    { id:"siting",    s:"S3", x: 540, y: 420, t:"EPA siting criteria", k:"standard", status:"active" },
    { id:"airflow",   s:"S3", x: 540, y: 500, t:"被动 vs 主动进气", k:"concept", status:"active" },

    // S4 — data + nowcast
    { id:"datafmt",   s:"S4", x: 720, y: 140, t:"数据格式 / UTC", k:"skill", status:"available" },
    { id:"nowcast",   s:"S4", x: 720, y: 230, t:"EPA NowCast 算法", k:"standard", status:"available" },
    { id:"calib",     s:"S4", x: 720, y: 320, t:"湿度校准 (CF=1)", k:"concept", status:"available" },
    { id:"plotting",  s:"S4", x: 720, y: 410, t:"matplotlib 绘图", k:"skill", status:"locked" },
    { id:"stats",     s:"S4", x: 720, y: 500, t:"移动加权平均", k:"concept", status:"locked" },

    // S5 — cloud
    { id:"mqtt",      s:"S5", x: 900, y: 180, t:"MQTT", k:"skill", status:"locked" },
    { id:"json",      s:"S5", x: 900, y: 270, t:"JSON schema", k:"skill", status:"locked" },
    { id:"openaq",    s:"S5", x: 900, y: 360, t:"OpenAQ Provider API", k:"standard", status:"locked" },
    { id:"privacy",   s:"S5", x: 900, y: 450, t:"位置数据隐私", k:"concept", status:"locked" },

    // S6 — write & submit
    { id:"crossval",  s:"S6", x: 1080, y: 200, t:"交叉验证 (5 km)", k:"skill", status:"locked" },
    { id:"writeup",   s:"S6", x: 1080, y: 300, t:"科学写作", k:"skill", status:"locked" },
    { id:"submit",    s:"S6", x: 1080, y: 400, t:"OpenAQ 审核", k:"standard", status:"locked" },
  ], []);

  const EDGES = useMemo(() => [
    ["air","pm25"],["pm25","health"],["pm25","aqi"],["aqi","networks"],["health","aqi"],
    ["linux","ssh"],["voltage","solder"],["voltage","levelshift"],
    ["networks","laser"],["aqi","networks"],
    ["ssh","uart"],["uart","pms5003"],["laser","pms5003"],["levelshift","pms5003"],
    ["pms5003","i2c"],["i2c","bme280"],["pms5003","redundancy"],["bme280","redundancy"],
    ["pms5003","stevenson"],["bme280","drift"],["stevenson","siting"],["stevenson","airflow"],["drift","airflow"],
    ["pms5003","datafmt"],["datafmt","nowcast"],["nowcast","calib"],["drift","calib"],["calib","plotting"],["nowcast","stats"],
    ["nowcast","mqtt"],["mqtt","json"],["json","openaq"],["siting","openaq"],["openaq","privacy"],
    ["nowcast","crossval"],["openaq","crossval"],["crossval","writeup"],["writeup","submit"],["openaq","submit"]
  ], []);

  const [selected, setSelected] = useState("airflow");
  const [statusFilter, setStatusFilter] = useState("all");

  const counts = NODES.reduce((a,n)=> ({...a, [n.status]: (a[n.status]||0)+1}), {});
  const node = NODES.find(n => n.id === selected);

  const W = 1180, H = 600;

  return (
    <main style={{display:"grid", gridTemplateColumns:"1fr 360px", height:"100%", flex:1, minHeight:0}}>
      {/* CANVAS */}
      <section style={{
        position:"relative", overflow:"hidden",
        background: `
          radial-gradient(circle, #E8E2D3 0.8px, transparent 1px) 0 0 / 18px 18px,
          var(--paper)
        `
      }}>
        {/* top bar */}
        <div style={{
          position:"absolute", top: 16, left: 24, right: 24,
          display:"flex", alignItems:"center", justifyContent:"space-between", zIndex: 4,
          gap: 12
        }}>
          <div style={{display:"flex", alignItems:"center", gap: 14}}>
            <div>
              <div className="eyebrow" style={{marginBottom: 3}}><span className="dot"/> Knowledge tree</div>
              <div style={{fontSize: 18, letterSpacing:"-.02em", lineHeight:1, fontWeight:600}}>
                {project.slug}
              </div>
            </div>
          </div>

          <div style={{display:"flex", gap: 8, alignItems:"center"}}>
            <Legend dot="var(--bio)"        t="38 mastered"  active={statusFilter==="mastered"} onClick={()=>setStatusFilter(f=>f==="mastered"?"all":"mastered")}/>
            <Legend dot="var(--primary)"    t="4 active"     active={statusFilter==="active"} onClick={()=>setStatusFilter(f=>f==="active"?"all":"active")}/>
            <Legend dot="var(--aerospace)"  t="5 available"  active={statusFilter==="available"} onClick={()=>setStatusFilter(f=>f==="available"?"all":"available")}/>
            <Legend dot="var(--sub-2)"      t="9 locked"     active={statusFilter==="locked"} onClick={()=>setStatusFilter(f=>f==="locked"?"all":"locked")}/>
            {onClose && (
              <button onClick={onClose} className="btn btn-ghost btn-sm" style={{marginLeft: 8, background:"var(--card)"}}>
                <Icon name="x" size={13}/> Close
              </button>
            )}
          </div>
        </div>

        {/* section column headers */}
        <div style={{position:"absolute", top: 80, left: 0, right: 0, height: 28, zIndex: 3, pointerEvents:"none"}}>
          {["S1 · AQI 基础","S2 · Linux + 硬件","S3 · 传感器","S4 · 数据 / NowCast","S5 · 云端 / OpenAQ","S6 · 验证 / 提交"].map((label, i)=>{
            const x = 80 + i*180;
            return (
              <div key={i} style={{
                position:"absolute", left: x - 70, width: 160, textAlign:"center",
                fontFamily:"var(--mono)", fontSize: 10.5, color:"var(--sub)", letterSpacing:".05em"
              }}>{label}</div>
            );
          })}
        </div>

        {/* Graph SVG */}
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%"
          style={{position:"absolute", inset:0, paddingTop: 110}}>
          <defs>
            <marker id="arrow" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
              <path d="M0 0 L6 3 L0 6" fill="#999999"/>
            </marker>
            <marker id="arrow-active" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
              <path d="M0 0 L6 3 L0 6" fill="#D97757"/>
            </marker>
          </defs>

          {/* vertical section dividers */}
          {[170, 350, 620, 800, 980].map((x,i)=>(
            <line key={i} x1={x} x2={x} y1="20" y2={H-20}
              stroke="#E8E2D3" strokeDasharray="2 6" strokeWidth="1"/>
          ))}

          {/* edges */}
          {EDGES.map(([a,b], i)=>{
            const A = NODES.find(n=>n.id===a), B = NODES.find(n=>n.id===b);
            if (!A || !B) return null;
            const involvesSelected = selected && (a===selected || b===selected);
            const isActive = (A.status==="active" || B.status==="active") && (A.status!=="locked" && B.status!=="locked");
            const dimmed = statusFilter!=="all" && !(A.status===statusFilter || B.status===statusFilter) && !involvesSelected;

            // curve
            const dx = Math.abs(B.x - A.x);
            const cx1 = A.x + dx*0.4, cx2 = B.x - dx*0.4;
            return (
              <path key={i}
                d={`M${A.x} ${A.y} C ${cx1} ${A.y}, ${cx2} ${B.y}, ${B.x} ${B.y}`}
                fill="none"
                stroke={involvesSelected ? "#D97757" : isActive ? "#ECB294" : "#D8D4C8"}
                strokeWidth={involvesSelected ? 1.6 : 1}
                opacity={dimmed ? .15 : 1}
                markerEnd={involvesSelected ? "url(#arrow-active)" : "url(#arrow)"}
              />
            );
          })}

          {/* nodes */}
          {NODES.map(n => {
            const isSel = n.id === selected;
            const dimmed = statusFilter!=="all" && n.status!==statusFilter && !isSel;
            return (
              <Node key={n.id} n={n} selected={isSel} dimmed={dimmed}
                onClick={()=>setSelected(n.id)}/>
            );
          })}
        </svg>

        {/* bottom-left mini stats */}
        <div style={{
          position:"absolute", bottom: 16, left: 24,
          display:"flex", gap: 14, alignItems:"center",
          padding:"10px 14px",
          background:"var(--card)", border:"1px solid var(--border)", borderRadius: 10,
          fontFamily:"var(--mono)", fontSize: 11, color:"var(--sub)"
        }}>
          <span><Icon name="node" size={12} style={{verticalAlign:-1, color:"var(--ink-2)"}}/> {NODES.length} concepts</span>
          <span style={{opacity:.5}}>·</span>
          <span><Icon name="git-branch" size={12} style={{verticalAlign:-1, color:"var(--ink-2)"}}/> {EDGES.length} prerequisites</span>
          <span style={{opacity:.5}}>·</span>
          <span style={{color:"var(--emerald)"}}>{counts.mastered} mastered</span>
          <span style={{opacity:.5}}>·</span>
          <span style={{color:"var(--violet)"}}>{counts.active} active</span>
        </div>

        {/* bottom-right zoom */}
        <div style={{position:"absolute", bottom: 16, right: 24, display:"flex", gap: 6}}>
          <button className="btn btn-ghost btn-sm" style={{background:"var(--card)"}}><Icon name="plus" size={13}/></button>
          <button className="btn btn-ghost btn-sm" style={{background:"var(--card)"}}>1:1</button>
          <button className="btn btn-ghost btn-sm" style={{background:"var(--card)"}}>fit</button>
        </div>
      </section>

      {/* DETAIL PANEL */}
      <aside style={{borderLeft:"1px solid var(--border)", background:"var(--card)", overflowY:"auto"}}>
        <ConceptDetail node={node} go={go}/>
      </aside>
    </main>
  );
}

function Legend({ dot, t, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display:"inline-flex", alignItems:"center", gap: 8,
      padding:"6px 10px", borderRadius: 999,
      border:"1px solid var(--border-2)", background: active? "var(--card)":"transparent",
      fontFamily:"var(--mono)", fontSize: 11, color: "var(--ink-2)",
      cursor:"pointer"
    }}>
      <span style={{width:8, height:8, borderRadius:999, background:dot}}/>
      {t}
    </button>
  );
}

function Node({ n, selected, dimmed, onClick }) {
  const colors = {
    mastered:  { fill:"#EFE2D2", stroke:"#A67B5B", ink:"#5E412A" },
    active:    { fill:"#fff",    stroke:"#D97757", ink:"#9A4A2E" },
    available: { fill:"#fff",    stroke:"#D97757", ink:"#7A3A1E" },
    locked:    { fill:"#F0EEE7", stroke:"#999999", ink:"#9A9A9F" },
  }[n.status];

  const w = Math.min(150, Math.max(86, n.t.length * 8.4 + 24));
  const h = 28;
  return (
    <g transform={`translate(${n.x - w/2} ${n.y - h/2})`}
       onClick={onClick}
       style={{cursor:"pointer", opacity: dimmed ? .25 : 1, transition:"opacity 200ms"}}>
      {selected && (
        <rect x={-4} y={-4} width={w+8} height={h+8} rx="9" fill="none"
          stroke="#D97757" strokeWidth="1.4" strokeDasharray="3 3"/>
      )}
      {n.status==="active" && (
        <rect x={-3} y={-3} width={w+6} height={h+6} rx="8" fill="none"
          stroke="#D97757" strokeOpacity=".25" strokeWidth="1"/>
      )}
      <rect width={w} height={h} rx="6" fill={colors.fill} stroke={colors.stroke} strokeWidth="1"/>
      {/* kind dot */}
      <circle cx={10} cy={14} r="3" fill={colors.stroke}/>
      <text x={20} y={18} fontFamily="Inter, sans-serif" fontSize="11.5" fill={colors.ink} fontWeight={selected?600:500}>
        {n.t}
      </text>
      {/* tiny kind label */}
      <text x={w-8} y={18} textAnchor="end" fontFamily="JetBrains Mono" fontSize="9" fill={colors.ink} opacity=".55">
        {n.k}
      </text>
    </g>
  );
}

function ConceptDetail({ node, go }) {
  if (!node) return null;

  const kindLabel = {
    concept: "concept · 概念",
    skill:   "skill · 可操作技能",
    tool:    "tool · 具体器件",
    standard:"standard · 工业标准",
  }[node.k];

  const statusLabel = {
    mastered:  { t: "Mastered", pip:"ok",   sub:"finished + assessment passed"},
    active:    { t: "In progress",pip:"run", sub:"appears in your current module"},
    available: { t: "Available", pip:"warn", sub:"prerequisites met — can start"},
    locked:    { t: "Locked",    pip:"idle", sub:"depends on concepts not yet mastered"},
  }[node.status];

  return (
    <div>
      <div style={{padding:"20px 20px 14px", borderBottom:"1px solid var(--border)"}}>
        <div className="mono" style={{fontSize: 11, color:"var(--sub)"}}>{kindLabel}</div>
        <h2 style={{fontSize: 22, lineHeight: 1.2, letterSpacing:"-.025em", marginTop: 6, fontWeight:600}}>
          {node.t}
        </h2>
        <div style={{marginTop: 12, display:"flex", alignItems:"center", gap: 10}}>
          <span className={"pip " + statusLabel.pip}>{statusLabel.t.toUpperCase()}</span>
          <span className="mono" style={{fontSize: 10.5, color:"var(--sub)"}}>{statusLabel.sub}</span>
        </div>
      </div>

      {/* description */}
      <div style={{padding: 20, borderBottom:"1px solid var(--border)"}}>
        <p className="body" style={{fontSize: 13, lineHeight:1.6}}>
          {nodeBodies[node.id] || "Description coming soon."}
        </p>
      </div>

      {/* prerequisites */}
      <DetailBlock title="Prerequisites" count={3}>
        <DepRow t="PMS5003" status="mastered"/>
        <DepRow t="BME280 (湿度)" status="mastered"/>
        <DepRow t="EPA siting criteria" status="active" current/>
      </DetailBlock>

      {/* unlocks */}
      <DetailBlock title="Unlocks" count={4}>
        <DepRow t="数据格式化 / UTC" status="available" forward/>
        <DepRow t="EPA NowCast 算法" status="available" forward/>
        <DepRow t="湿度校准 (CF=1)"  status="available" forward/>
        <DepRow t="交叉验证 (5 km)" status="locked" forward/>
      </DetailBlock>

      {/* covered in */}
      <DetailBlock title="Covered in" count={1}>
        <ModuleRow code="M14" t="防水盒、气流与户外安装" current/>
      </DetailBlock>

      {/* references */}
      <DetailBlock title="Industry references" count={3}>
        <RefRow t="PurpleAir Forum — 2022 fan A/B test" s="forum.purpleair.com"/>
        <RefRow t="EPA AirNow — Monitor Siting Guide" s="airnow.gov/aqi"/>
        <RefRow t="Plantower PMS5003 Datasheet rev. 1.4" s="plantower.com" last/>
      </DetailBlock>

      {/* actions */}
      <div style={{padding: 22, display:"flex", flexDirection:"column", gap: 10}}>
        <button className="btn btn-violet" style={{justifyContent:"center"}} onClick={()=>go("learn")}>
          <Icon name="circle-play" size={14}/> Open M14 to study this
        </button>
        <button className="btn btn-ghost" style={{justifyContent:"center"}}>
          <Icon name="bot" size={14}/> Ask agent to teach me from scratch
        </button>
      </div>
    </div>
  );
}

const nodeBodies = {
  airflow:   "Decide between passive (Stevenson screen) and active (small fan) airflow. The tradeoff is temperature drift vs power budget.",
  stevenson: "Multi-layer louvers that let air through while blocking direct sun. 19th-c. weather-station design — PurpleAir uses a 3D-printed version.",
  drift:     "PMS5003 overestimates particles at high humidity (>85%) and high temp (>30°C). M12's BME280 supplies the humidity input for NowCast correction.",
  siting:    "EPA accepts data when (1) inlet is 2–15m up, (2) no emissions within 20m, (3) ≥270° unobstructed view, (4) away from AC exhaust.",
  nowcast:   "EPA 2013 formula that converts 1-hour PM2.5 to AQI with weighted lookback — more sensitive when concentrations rise.",
  pms5003:   "Plantower's laser particle sensor. UART, 1 frame/sec, PM1/2.5/10. Same chip used by PurpleAir and IQAir. $35.",
  openaq:    "Provider registry for community air-quality nodes. Requires 30 days of continuous uploads + cross-validation.",
};

function DetailBlock({ title, count, children }) {
  return (
    <div style={{borderBottom:"1px solid var(--border)"}}>
      <div style={{padding:"14px 22px 4px", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <span className="mono" style={{fontSize: 11, color:"var(--sub)", letterSpacing:".06em"}}>{title.toUpperCase()}</span>
        <span className="mono" style={{fontSize: 11, color:"var(--sub-2)"}}>{count}</span>
      </div>
      <div style={{padding:"0 22px 14px"}}>{children}</div>
    </div>
  );
}

function DepRow({ t, status, current, forward }) {
  const dot = {mastered:"var(--emerald)", active:"var(--violet)", available:"var(--amber)", locked:"var(--sub-2)"}[status];
  return (
    <div style={{display:"flex", alignItems:"center", gap: 10, padding:"7px 0", borderBottom:"1px dashed var(--border)"}}>
      <span style={{width:8, height:8, borderRadius:999, background:dot}}/>
      <span style={{fontSize: 13, color: status==="locked"?"var(--sub)":"var(--ink-2)", flex:1}}>{t}</span>
      {current && <span className="tag violet" style={{fontSize:10}}>here</span>}
      {forward && <Icon name="chevron-right" size={12} style={{color:"var(--sub-2)"}}/>}
    </div>
  );
}

function ModuleRow({ code, t, current }) {
  return (
    <div style={{display:"flex", alignItems:"center", gap: 12, padding:"10px 0"}}>
      <span className="mono" style={{fontSize: 11, color:"var(--sub-2)", width: 28}}>{code}</span>
      <span style={{fontSize: 13.5, color:"var(--ink-2)", flex:1}}>{t}</span>
      {current && <span className="pip run" style={{fontSize:10}}>current</span>}
    </div>
  );
}

function RefRow({ t, s, last }) {
  return (
    <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom: last? "0":"1px dashed var(--border)"}}>
      <div style={{minWidth:0, flex:1, paddingRight:10}}>
        <div style={{fontSize: 12.5, color:"var(--ink-2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{t}</div>
        <div className="mono" style={{fontSize: 10.5, color:"var(--sub)", marginTop:2}}>{s}</div>
      </div>
      <Icon name="external" size={12} style={{color:"var(--sub-2)"}}/>
    </div>
  );
}

window.KnowledgeTree = KnowledgeTree;
