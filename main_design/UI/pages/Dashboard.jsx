/* Dashboard — logged-in home for a learner */
function Dashboard({ go, project }) {
  return (
    <main className="page-wide" style={{paddingTop: 20}}>
      <Crumbs items={[{label:"Home"}, {label:"Dashboard"}]} />

      {/* greeting */}
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-end", margin:"12px 0 24px"}}>
        <div>
          <div className="eyebrow" style={{marginBottom: 8}}><span className="dot"/> Tue · Week 13 / 26</div>
          <h1 className="h1" style={{fontSize: 30}}>
            Welcome back, xinghan
          </h1>
          <p className="body" style={{maxWidth: 540, marginTop: 6, color:"var(--sub)", fontSize:13.5}}>
            47% through purpleair-airquality-node. Agent has 2 flags for review.
          </p>
        </div>
        <div style={{display:"flex", gap: 10}}>
          <button className="btn btn-ghost"><Icon name="calendar" size={14}/> Schedule</button>
          <button className="btn btn-violet" onClick={()=>go("learn")}><Icon name="circle-play" size={14}/> Continue M14</button>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap: 0, border:"1px solid var(--border)", borderRadius: 12, overflow:"hidden", background:"var(--card)", marginBottom: 24}}>
        <DashStat icon="layers"    label="Modules done" value="13 / 30"    sub="last: M13 · 加备份" />
        <DashStat icon="clock"     label="Time on project" value="47.2 hr" sub="of an estimated 90 hr" />
        <DashStat icon="trending"  label="Concepts mastered" value="38"    sub="of 56 in the tree" />
        <DashStat icon="wave"      label="Sensor uptime" value="99.4%"     sub="9d · 2,073 samples" />
        <DashStat icon="sparkles"  label="Agent runs"   value="142"        sub="last 7 days" last />
      </div>

      {/* main grid */}
      <div style={{display:"grid", gridTemplateColumns:"1.55fr 1fr", gap: 18}}>
        {/* Continue learning panel */}
        <section className="card" style={{padding: 0, overflow:"hidden"}}>
          <div style={{padding:"18px 22px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid var(--border)"}}>
            <div>
              <div className="eyebrow" style={{marginBottom:6}}><span className="dot"/> Continue</div>
              <h2 className="h2">Active project</h2>
            </div>
            <div style={{display:"flex", gap: 8}}>
              <button className="btn btn-ghost btn-sm" onClick={()=>go("myprojects")}>All 4 forks <Icon name="arrow-right" size={13}/></button>
              <button className="btn btn-ghost btn-sm" onClick={()=>go("project")}>Project home <Icon name="arrow-right" size={13}/></button>
            </div>
          </div>

          <div style={{display:"grid", gridTemplateColumns: "1fr 1fr"}}>
            {/* left: project meta */}
            <div style={{padding:"22px", borderRight:"1px solid var(--border)"}}>
              <div style={{display:"flex", gap:6, alignItems:"center", marginBottom: 10}}>
                <span className="tag climate">{project.domain}</span>
                <span className="tag">{project.age}</span>
                <span className="tag">{project.weeks}w</span>
              </div>
              <div className="mono" style={{fontSize: 11.5, color:"var(--sub-2)"}}>{project.slug}</div>
              <h3 style={{fontSize: 19, lineHeight: 1.25, marginTop: 6, letterSpacing:"-.02em", fontWeight:600}}>
                {project.title}
              </h3>

              {/* Progress */}
              <div style={{marginTop: 22}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 8}}>
                  <span className="mono" style={{fontSize:11, color:"var(--sub)"}}>S3 · 传感器集成</span>
                  <span className="mono" style={{fontSize:11, color:"var(--ink)"}}>47%</span>
                </div>
                <div className="bar violet"><i style={{width:"47%"}}/></div>
                <div style={{marginTop:8, display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--sub)", fontFamily:"var(--mono)"}}>
                  <span>13 / 30 modules</span>
                  <span>≈ 13 wk left</span>
                </div>
              </div>

              <button className="btn btn-violet" style={{marginTop:20, width:"100%", justifyContent:"center"}} onClick={()=>go("learn")}>
                <Icon name="circle-play" size={14}/> M14 · 防水盒、气流与户外安装
              </button>
            </div>

            {/* right: recent modules */}
            <div style={{padding:"22px"}}>
              <div className="mono" style={{fontSize:11.5, color:"var(--sub)", marginBottom:14}}>RECENT TRAIL</div>
              <div style={{display:"flex", flexDirection:"column", gap: 0}}>
                <TrailRow code="M13" t="加备份 PMS7003 + MQ-135：为什么要冗余" stat="done" time="42 min"/>
                <TrailRow code="M12" t="BME280：温度湿度气压三合一（I2C）" stat="done" time="1 h 8 m"/>
                <TrailRow code="M11" t="接好 PMS5003，第一条数据出来了" stat="done" time="2 h 14 m"/>
                <TrailRow code="M14" t="防水盒、气流与户外安装（含命名仪式）" stat="next" time="≈ 1 h" highlight/>
                <TrailRow code="M15" t="数据格式化：UTC 时间戳 + Plantower CF=1" stat="locked" time="— "/>
              </div>
            </div>
          </div>

          {/* footer */}
          <div style={{display:"flex", borderTop:"1px solid var(--border)", padding:"12px 22px", gap: 24, fontSize:12.5, color:"var(--sub)"}}>
            <span><Icon name="calendar" size={12} style={{verticalAlign:-1}}/> Forked Sep 9 · 13 wk ago</span>
            <span><Icon name="git-branch" size={12} style={{verticalAlign:-1}}/> v1.4.2</span>
            <span><Icon name="users" size={12} style={{verticalAlign:-1}}/> 4 cohort peers ahead, 11 behind</span>
            <span style={{marginLeft:"auto", color:"var(--violet)"}} onClick={()=>go("tree")}>
              <Icon name="node" size={12} style={{verticalAlign:-1}}/> Knowledge tree <Icon name="arrow-up-right" size={11} style={{verticalAlign:-1}}/>
            </span>
          </div>
        </section>

        {/* right column */}
        <div style={{display:"flex", flexDirection:"column", gap: 18}}>
          {/* Agent flags */}
          <section className="card" style={{padding: 0, overflow:"hidden"}}>
            <div style={{padding:"16px 20px 14px", borderBottom:"1px solid var(--border)"}}>
              <div className="eyebrow" style={{marginBottom: 6}}><span className="dot"/> Agent flagged</div>
              <h3 className="h3">2 things to look at</h3>
            </div>
            <AgentRow icon="bot"
              t="Your PM2.5 reading at 03:14 was 4.3× the EPA station 5km away"
              meta="suspect humidity spike · M12 · 4 min read"/>
            <AgentRow icon="sparkles" last
              t="Found a 2024 PMS5003 datasheet correction worth a look"
              meta="upstream · low priority"/>
          </section>

          {/* recommended */}
          <section className="card" style={{padding: 20}}>
            <div className="eyebrow" style={{marginBottom: 10}}><span className="dot"/> Because you finished M11</div>
            <h3 className="h3" style={{marginBottom: 14}}>Adjacent projects</h3>
            <RecRow t="437.4 MHz cubesat 地面接收站" tag="Aerospace" w={18}/>
            <RecRow t="LoRa 末梢气象站集群（4 节点 mesh）" tag="Climate" w={14}/>
            <RecRow t="家用环境的微塑料目视计数管线" tag="Bioscience" w={12} last/>
          </section>
        </div>
      </div>
    </main>
  );
}

function DashStat({ icon, label, value, sub, last }) {
  return (
    <div style={{padding:"16px 20px", borderRight: last? "0" : "1px solid var(--border)", display:"flex", flexDirection:"column", gap: 6}}>
      <div style={{display:"flex", alignItems:"center", gap: 8, color:"var(--sub)"}}>
        <Icon name={icon} size={13}/>
        <span style={{fontSize:11.5, fontFamily:"var(--mono)", letterSpacing:".02em"}}>{label}</span>
      </div>
      <div style={{fontSize: 22, letterSpacing:"-.02em", lineHeight:1, color:"var(--ink)", fontWeight:600}}>{value}</div>
      <div className="mono" style={{fontSize: 11, color: "var(--sub)"}}>{sub}</div>
    </div>
  );
}

function TrailRow({ code, t, stat, time, highlight }) {
  const stats = {
    done:   { icon:"circle-check", color:"var(--emerald)" },
    next:   { icon:"circle-dot",   color:"var(--violet)" },
    locked: { icon:"circle",       color:"var(--sub-2)" },
  };
  const s = stats[stat];
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:10, padding:"10px 12px",
      margin:"0 -12px", borderRadius: 8,
      background: highlight ? "var(--violet-soft)" : "transparent"
    }}>
      <span style={{color: s.color, display:"inline-flex"}}><Icon name={s.icon} size={16}/></span>
      <span className="mono" style={{fontSize: 11, color:"var(--sub-2)", width: 32}}>{code}</span>
      <span style={{flex:1, fontSize: 13, color: stat==="locked"?"var(--sub)":"var(--ink-2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{t}</span>
      <span className="mono" style={{fontSize: 11, color:"var(--sub-2)"}}>{time}</span>
    </div>
  );
}

function Metric({ n, unit, sub }) {
  return (
    <div style={{padding: 12, background:"var(--paper)", borderRadius: 8, border:"1px solid var(--border)"}}>
      <div style={{display:"flex", alignItems:"baseline", gap: 5}}>
        <span style={{fontSize: 22, letterSpacing:"-.02em", lineHeight:1, fontWeight:600}}>{n}</span>
        <span className="mono" style={{fontSize: 10.5, color:"var(--sub)"}}>{unit}</span>
      </div>
      <div className="mono" style={{marginTop: 6, fontSize: 10.5, color:"var(--sub)"}}>{sub}</div>
    </div>
  );
}

function Sparkline() {
  // Mock 60min sparkline
  const pts = [12,14,16,15,18,22,28,32,35,30,28,25,21,18,16,17,19,22,30,38,42,40,36,32,28,26,24,23,20,18,16,17,21,28,35,40,38,33,29,26,24,22,21,23,26,29,32];
  const max = Math.max(...pts), min = Math.min(...pts);
  const w = 280, h = 60, step = w/(pts.length-1);
  const path = pts.map((p,i)=> {
    const x = i*step;
    const y = h - ((p-min)/(max-min))*h;
    return `${i===0?"M":"L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  const area = path + ` L ${w} ${h} L 0 ${h} Z`;
  return (
    <div style={{borderTop:"1px dashed var(--border)", paddingTop: 12}}>
      <div style={{display:"flex", justifyContent:"space-between", marginBottom: 6}}>
        <span className="mono" style={{fontSize: 10.5, color:"var(--sub-2)"}}>AQI · last 60 min</span>
        <span className="mono" style={{fontSize: 10.5, color:"var(--sub)"}}>peak 42 at 20:47</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
        <defs>
          <linearGradient id="dashspark" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#D97757" stopOpacity=".25"/>
            <stop offset="1" stopColor="#D97757" stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d={area} fill="url(#dashspark)"/>
        <path d={path} fill="none" stroke="#D97757" strokeWidth="1.5"/>
      </svg>
    </div>
  );
}

function AgentRow({ icon, t, meta, last }) {
  return (
    <div style={{padding:"14px 20px", borderBottom: last? "0":"1px solid var(--border)", display:"flex", gap: 12, alignItems:"flex-start", cursor:"pointer"}}>
      <div style={{
        width:28, height:28, borderRadius: 7, background:"var(--violet-soft)",
        color:"var(--violet-ink)", display:"grid", placeItems:"center", flexShrink:0
      }}><Icon name={icon} size={14}/></div>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize: 13.5, color: "var(--ink-2)", lineHeight:1.4}}>{t}</div>
        <div className="mono" style={{marginTop: 4, fontSize: 10.5, color:"var(--sub)"}}>{meta}</div>
      </div>
      <Icon name="chevron-right" size={14} style={{color:"var(--sub-2)", marginTop: 6}}/>
    </div>
  );
}

function RecRow({ t, tag, w, last }) {
  return (
    <div style={{display:"flex", alignItems:"center", gap: 12, padding:"10px 0", borderBottom: last? "0" : "1px dashed var(--border)"}}>
      <div style={{width: 36, height: 36, borderRadius: 7, background: "var(--paper-2)", border:"1px solid var(--border)", display:"grid", placeItems:"center", flexShrink:0}}>
        <Icon name={tag==="Aerospace"?"antenna":tag==="Climate"?"wind":"flask"} size={15} style={{color:"var(--ink-2)"}}/>
      </div>
      <div style={{flex:1, minWidth:0, overflow:"hidden"}}>
        <div style={{fontSize: 13, color: "var(--ink-2)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{t}</div>
        <div className="mono" style={{fontSize: 10.5, color:"var(--sub)"}}>{tag} · {w}w</div>
      </div>
      <Icon name="arrow-up-right" size={13} style={{color:"var(--sub-2)"}}/>
    </div>
  );
}

window.Dashboard = Dashboard;
