/* ProjectHome — kept intentionally simple: hero + description + curriculum + outcomes */
function ProjectHome({ go, project, openTree }) {
  return (
    <main className="page-wide" style={{paddingTop: 18, maxWidth: 1100}}>
      <Crumbs items={[
        {label:"Home"},
        {label:"My Projects"},
        {label: project.slug, mono:true}
      ]}/>

      {/* Hero header */}
      <header style={{marginTop: 16, paddingBottom: 22, borderBottom: "1px solid var(--border)"}}>
        <div style={{display:"grid", gridTemplateColumns:"1.4fr 1fr", gap: 36, alignItems:"start"}}>
          <div>
            <div style={{display:"flex", gap: 6, alignItems:"center", marginBottom: 12, flexWrap:"wrap"}}>
              <span className="tag climate">{project.domain}</span>
              <span className="tag">{project.age}</span>
              <span className="tag">{project.weeks}w</span>
              <span className="tag">diff {project.difficulty}/10</span>
            </div>
            <div className="mono" style={{fontSize: 11.5, color: "var(--sub)"}}>{project.slug}</div>
            <h1 style={{
              fontSize: 34, lineHeight: 1.1, letterSpacing:"-.03em", fontWeight: 600,
              marginTop: 8, maxWidth: 640
            }}>
              {project.title}
            </h1>

            {/* meta line */}
            <div style={{marginTop: 18, display:"flex", alignItems:"center", gap: 12, color:"var(--sub)", flexWrap:"wrap"}}>
              <div style={{display:"flex", alignItems:"center", gap: 8}}>
                <div style={{width: 24, height: 24, borderRadius:999, background:"var(--primary-soft)", display:"grid", placeItems:"center", fontFamily:"var(--mono)", fontSize: 9.5, color:"var(--primary-ink)", fontWeight:600}}>LM</div>
                <span style={{fontSize: 13, color:"var(--ink-2)"}}>by <strong style={{color:"var(--ink)"}}>Lin Mu</strong></span>
              </div>
              <span style={{opacity:.5}}>·</span>
              <span className="mono" style={{fontSize: 11.5}}>forked Sep 9, 2025</span>
              <span style={{opacity:.5}}>·</span>
              <span className="mono" style={{fontSize: 11.5}}>v1.4.2</span>
            </div>
          </div>

          {/* Action panel */}
          <div style={{
            border:"1px solid var(--border)", borderRadius: 12, padding: 16,
            background:"var(--card)", display:"flex", flexDirection:"column", gap:10,
          }}>
            <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
              <div className="eyebrow"><span className="dot"/> Your fork</div>
              <span className="pip run" style={{fontSize:10.5}}>IN PROGRESS</span>
            </div>

            <div style={{marginTop: 2}}>
              <div style={{display:"flex", justifyContent:"space-between", fontSize: 11, color:"var(--sub)", fontFamily:"var(--mono)", marginBottom: 6}}>
                <span>13 / 30 modules</span>
                <span>47%</span>
              </div>
              <div className="bar violet"><i style={{width:"47%"}}/></div>
            </div>

            <button className="btn btn-violet btn-lg" style={{justifyContent:"center"}} onClick={()=>go("learn")}>
              <Icon name="circle-play" size={15}/> Continue · M14
            </button>

            <button className="btn btn-ghost" style={{justifyContent:"center"}} onClick={openTree}>
              <Icon name="node" size={14}/> Open knowledge tree
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div style={{marginTop: 28, display:"grid", gridTemplateColumns:"1fr", gap: 0, maxWidth: 880}}>
        {/* Description */}
        <Block n="01" t="About">
          <p className="body" style={{fontSize: 14.5, lineHeight:1.65}}>
            Build a calibrated PM2.5 node, run the official EPA NowCast formula on your own readings, and cross-validate against an EPA AirNow station within 5km. Your node joins the same public network used by hospitals, schools, and news rooms.
          </p>
          <div style={{display:"grid", gridTemplateColumns:"1.4fr 1fr", gap: 12, marginTop: 16}}>
            <CoverArt kind="climate"/>
            <Stripes height={168} label="board layout · pms5003 · pi zero 2 w" color="var(--paper-2)"/>
          </div>
        </Block>

        {/* What you'll ship */}
        <Block n="02" t="What you'll ship">
          <ul style={{listStyle:"none", padding:0, margin:0, display:"grid", gridTemplateColumns:"1fr 1fr", gap: 10}}>
            <Outcome t="Registered OpenAQ node" sub="real public data"/>
            <Outcome t="IP65 outdoor sensor box" sub="your build"/>
            <Outcome t="14 days cross-validated data" sub="vs nearest EPA station"/>
            <Outcome t="Writeup with 4 figures" sub="reproducible"/>
          </ul>
        </Block>

        {/* Curriculum */}
        <Block n="03" t="Curriculum · 6 sections · 30 modules" last>
          <Curriculum onOpenLearn={()=>go("learn")} onOpenTree={openTree}/>
        </Block>
      </div>
    </main>
  );
}

function Block({ n, t, children, last }) {
  return (
    <section style={{paddingBottom: 28, marginBottom: 28, borderBottom: last? "0": "1px solid var(--border)"}}>
      <div style={{display:"flex", gap: 10, alignItems:"baseline", marginBottom: 14}}>
        <span className="mono" style={{fontSize: 11, color:"var(--sub-2)"}}>§ {n}</span>
        <h2 className="h2">{t}</h2>
      </div>
      {children}
    </section>
  );
}

function Callout({ icon, t, body }) {
  return (
    <div style={{
      marginTop: 20,
      border:"1px solid var(--violet-line)", background:"var(--violet-soft)",
      borderRadius: 10, padding: "14px 16px",
      display:"grid", gridTemplateColumns:"auto 1fr", gap: 12
    }}>
      <div style={{width:28, height:28, borderRadius:7, background:"#fff", display:"grid", placeItems:"center", color:"var(--violet-ink)"}}>
        <Icon name={icon} size={15}/>
      </div>
      <div>
        <div style={{fontSize:13, fontWeight:600, color:"var(--violet-ink)"}}>{t}</div>
        <div className="body" style={{fontSize: 13.5, color:"var(--ink-2)", marginTop: 2}}>{body}</div>
      </div>
    </div>
  );
}

function RealWorld({ t, sub, icon }) {
  return (
    <div style={{padding: 14, border:"1px solid var(--border)", borderRadius: 9, background:"var(--paper)"}}>
      <Icon name={icon} size={16} style={{color:"var(--violet)"}}/>
      <div style={{fontWeight:600, marginTop: 8, fontSize: 14}}>{t}</div>
      <div className="body" style={{fontSize: 12.5, marginTop: 4, color:"var(--sub)"}}>{sub}</div>
    </div>
  );
}

function Prereq({ t, sub, have }) {
  return (
    <div style={{
      padding: 14, border:"1px solid var(--border)", borderRadius: 9,
      background: have ? "var(--emerald-soft)" : "var(--card)",
      borderColor: have ? "#DCC4A6" : "var(--border)"
    }}>
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
        <span style={{fontSize: 13.5, fontWeight: 600, color: have?"#5E412A":"var(--ink-2)"}}>{t}</span>
        <Icon name={have?"circle-check":"circle"} size={14} style={{color: have ? "var(--emerald)":"var(--sub-2)"}}/>
      </div>
      <div className="body" style={{fontSize: 12, marginTop: 6, color: have?"#5E412A":"var(--sub)"}}>{sub}</div>
    </div>
  );
}

function Kvp({ k, v }) {
  return (
    <div style={{display:"flex", justifyContent:"space-between", fontSize:12}}>
      <span className="mono" style={{color:"var(--sub)"}}>{k}</span>
      <span style={{color:"var(--ink-2)"}}>{v}</span>
    </div>
  );
}

function BomHead() {
  return (
    <div style={{
      display:"grid", gridTemplateColumns:"1fr 80px 220px",
      padding:"8px 4px", fontFamily:"var(--mono)", fontSize: 11, color:"var(--sub)",
      borderBottom: "1px solid var(--border)"
    }}>
      <span>ITEM</span><span style={{textAlign:"right"}}>COST</span><span>NOTES</span>
    </div>
  );
}
function BomRow({ item, cost, note, hi, muted }) {
  return (
    <div style={{
      display:"grid", gridTemplateColumns:"1fr 80px 220px",
      padding:"11px 4px",
      borderBottom: "1px dashed var(--border)",
      background: hi ? "var(--violet-soft)" : "transparent",
      color: muted ? "var(--sub)" : "var(--ink-2)",
      fontSize: 13.5
    }}>
      <span>{item}</span>
      <span style={{textAlign:"right", fontFamily:"var(--mono)", fontSize:12.5, color: muted?"var(--sub-2)":"var(--ink)"}}>{cost}</span>
      <span style={{fontSize:12.5, color:"var(--sub)"}}>{note}</span>
    </div>
  );
}

function Outcome({ t, sub }) {
  return (
    <li style={{
      padding: 14, border:"1px solid var(--border)", borderRadius: 9, background:"var(--card)",
      display:"grid", gridTemplateColumns:"auto 1fr", gap: 12, alignItems:"flex-start"
    }}>
      <span style={{color:"var(--emerald)", marginTop: 2}}><Icon name="flag" size={15}/></span>
      <div>
        <div style={{fontSize: 13.5, fontWeight:600, color: "var(--ink)"}}>{t}</div>
        <div className="body" style={{fontSize: 12.5, color:"var(--sub)", marginTop: 4}}>{sub}</div>
      </div>
    </li>
  );
}

function Curriculum({ onOpenLearn, onOpenTree }) {
  const secs = [
    { id:"S1", t:"空气、健康与 AQI 概念基础", w:"wk 1–3", done:4, total:4, items:[
      { code:"M01", t:"空气里到底有什么？认识颗粒物", done:true },
      { code:"M02", t:"PM2.5 / PM10：为什么'小'才危险", done:true },
      { code:"M03", t:"AQI 是什么？怎么把'浓度'变成'颜色等级'", done:true },
      { code:"M04", t:"全球空气网络：PurpleAir、OpenAQ、EPA / CNEMC", done:true },
    ]},
    { id:"S2", t:"Linux 与硬件入门", w:"wk 4–6", done:4, total:4, items:[
      { code:"M05", t:"树莓派是什么？开箱与烧录系统", done:true },
      { code:"M06", t:"第一次连 SSH：从你的电脑控制远方的电脑", done:true },
      { code:"M07", t:"Linux 命令行 10 个必会命令", done:true },
      { code:"M08", t:"电与焊接安全：万用表 5 分钟入门 + 电平转换概念", done:true },
    ]},
    { id:"S3", t:"传感器读取与硬件集成", w:"wk 7–13", done:5, total:6, items:[
      { code:"M09", t:"激光散射：传感器怎么\"看见\"颗粒物", done:true },
      { code:"M10", t:"UART 串口通信：让两块电路板讲话", done:true },
      { code:"M11", t:"接好 PMS5003，第一条数据出来了", done:true },
      { code:"M12", t:"BME280：温度湿度气压三合一（I²C）", done:true },
      { code:"M13", t:"加备份 PMS7003 + MQ-135：为什么要冗余", done:true },
      { code:"M14", t:"防水盒、气流与户外安装（含命名仪式）", current:true },
    ]},
    { id:"S4", t:"数据处理与 EPA NowCast 算法", w:"wk 14–18", done:0, total:6 },
    { id:"S5", t:"云端、隐私与 OpenAQ Provider 接入", w:"wk 19–22", done:0, total:5 },
    { id:"S6", t:"交叉验证、写作与提交", w:"wk 23–26", done:0, total:5 },
  ];
  const [open, setOpen] = useState({ S3: true });
  return (
    <div>
      {secs.map(s => (
        <div key={s.id} style={{border:"1px solid var(--border)", borderRadius: 10, marginBottom: 10, background: "var(--card)"}}>
          <button onClick={()=>setOpen(o=>({...o, [s.id]: !o[s.id]}))}
            style={{
              display:"grid", gridTemplateColumns:"auto auto 1fr auto auto",
              gap: 12, alignItems:"center",
              padding:"14px 18px", width:"100%", border:0, background:"transparent",
              cursor:"pointer", textAlign:"left"
            }}>
            <span className="mono" style={{fontSize:11, color:"var(--sub-2)", width:28}}>{s.id}</span>
            <span style={{fontWeight: 600, fontSize: 14.5}}>{s.t}</span>
            <span className="mono" style={{fontSize:11, color:"var(--sub)"}}>{s.w}</span>
            <span className="mono" style={{fontSize:11, color: s.done===s.total ? "var(--emerald)" : "var(--ink-2)"}}>
              {s.done}/{s.total}
            </span>
            <Icon name={open[s.id]?"chevron-down":"chevron-right"} size={14} style={{color:"var(--sub-2)"}}/>
          </button>
          {open[s.id] && s.items && (
            <div style={{borderTop:"1px solid var(--border)"}}>
              {s.items.map((m, i) => (
                <div key={i} onClick={m.current ? onOpenLearn : null}
                  style={{
                  display:"grid", gridTemplateColumns:"auto auto 1fr auto",
                  gap: 12, alignItems:"center",
                  padding:"10px 18px",
                  cursor: m.current ? "pointer" : "default",
                  background: m.current ? "var(--violet-soft)" : "transparent",
                  borderBottom: i === s.items.length-1 ? "0" : "1px dashed var(--border)"
                }}>
                  <Icon name={m.done?"circle-check":m.current?"circle-dot":"circle"} size={15}
                    style={{color: m.done?"var(--emerald)":m.current?"var(--violet)":"var(--sub-2)"}}/>
                  <span className="mono" style={{fontSize:11.5, color:"var(--sub-2)", width: 32}}>{m.code}</span>
                  <span style={{fontSize: 13.5, color: m.done?"var(--sub)":"var(--ink-2)"}}>{m.t}</span>
                  {m.current && <span className="tag violet" style={{fontSize:10}}>NEXT</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function KnowledgePreview({ onOpen }) {
  return (
    <div className="card" style={{padding: 18, cursor:"pointer", overflow:"hidden", position:"relative"}} onClick={onOpen}>
      <div className="eyebrow" style={{marginBottom: 10}}><span className="dot"/> Knowledge tree · live</div>
      <h4 className="h3" style={{marginBottom: 10}}>56 concepts · 38 mastered</h4>
      <MiniTree/>
      <div style={{marginTop: 12, display:"flex", justifyContent:"space-between"}}>
        <div style={{display:"flex", gap: 14, fontSize: 11, fontFamily:"var(--mono)", color:"var(--sub)"}}>
          <span style={{color:"var(--emerald)"}}>● 38 mastered</span>
          <span style={{color:"var(--violet)"}}>● 4 active</span>
          <span style={{color:"var(--sub-2)"}}>● 14 locked</span>
        </div>
        <span style={{color:"var(--violet)", fontSize:12.5, display:"inline-flex", alignItems:"center", gap:4}}>
          Open <Icon name="arrow-up-right" size={12}/>
        </span>
      </div>
    </div>
  );
}

function MiniTree() {
  // small decorative knowledge graph
  const nodes = [
    [50, 30, "ok"],[110, 18, "ok"],[170, 30, "ok"],[230, 18, "ok"],[280, 32, "ok"],
    [40, 70, "ok"],[100, 64, "ok"],[160, 78, "ok"],[225, 70, "active"],[280, 80, "active"],
    [60, 120, "ok"],[120, 116, "active"],[180, 128, "locked"],[240, 120, "locked"],[280, 128, "locked"],
    [50, 170, "locked"],[120, 168, "locked"],[200, 172, "locked"],[270, 168, "locked"],
  ];
  const edges = [
    [0,5],[1,5],[1,6],[2,6],[2,7],[3,7],[3,8],[4,8],[4,9],
    [5,10],[6,10],[6,11],[7,11],[7,12],[8,12],[8,13],[9,13],[9,14],
    [10,15],[11,15],[11,16],[12,16],[12,17],[13,17],[14,18]
  ];
  const cmap = { ok:"#A67B5B", active:"#D97757", locked:"#999999" };
  return (
    <svg viewBox="0 0 320 200" width="100%" height="180">
      {edges.map(([a,b],i)=>(
        <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]}
          stroke="#D8D4C8" strokeWidth="0.8"/>
      ))}
      {nodes.map(([x,y,k],i)=>(
        <g key={i}>
          <circle cx={x} cy={y} r="4" fill={cmap[k]} opacity={k==="locked"?.5:1}/>
          {k==="active" && <circle cx={x} cy={y} r="8" fill="none" stroke={cmap[k]} strokeOpacity=".3"/>}
        </g>
      ))}
    </svg>
  );
}

function Thread({ t, by, replies, last }) {
  return (
    <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap: 10, padding:"10px 0", borderBottom: last? "0":"1px dashed var(--border)"}}>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize: 13, color:"var(--ink-2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{t}</div>
        <div className="mono" style={{fontSize: 10.5, color:"var(--sub)", marginTop:3}}>@{by} · {replies} replies</div>
      </div>
      <Icon name="chevron-right" size={13} style={{color:"var(--sub-2)"}}/>
    </div>
  );
}

function UpstreamRow({ t, url, last }) {
  return (
    <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom: last? "0":"1px dashed var(--border)"}}>
      <div>
        <div style={{fontSize: 13, color:"var(--ink-2)"}}>{t}</div>
        <div className="mono" style={{fontSize: 10.5, color:"var(--sub)", marginTop:2}}>{url}</div>
      </div>
      <Icon name="external" size={13} style={{color:"var(--sub-2)"}}/>
    </div>
  );
}

window.ProjectHome = ProjectHome;
