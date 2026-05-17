/* ProjectLearn — the actual learning workspace */
function ProjectLearn({ go, project }) {
  const [activeM, setActiveM] = useState("M14");
  const [agentOpen, setAgentOpen] = useState(true);

  const modules = useMemo(() => [
    { s:"S1", t:"空气、健康与 AQI 概念基础", items:[
      {c:"M01", t:"空气里到底有什么？", done:true},
      {c:"M02", t:"PM2.5 / PM10：为什么'小'才危险", done:true},
      {c:"M03", t:"AQI 是什么？", done:true},
      {c:"M04", t:"全球空气网络", done:true},
    ]},
    { s:"S2", t:"Linux 与硬件入门", items:[
      {c:"M05", t:"树莓派开箱与烧录系统", done:true},
      {c:"M06", t:"第一次连 SSH", done:true},
      {c:"M07", t:"Linux 命令行 10 个必会", done:true},
      {c:"M08", t:"电与焊接安全 + 电平转换", done:true},
    ]},
    { s:"S3", t:"传感器读取与硬件集成", items:[
      {c:"M09", t:"激光散射：怎么\"看见\"颗粒物", done:true},
      {c:"M10", t:"UART 串口通信", done:true},
      {c:"M11", t:"接好 PMS5003，第一条数据", done:true},
      {c:"M12", t:"BME280：温/湿/压三合一 (I²C)", done:true},
      {c:"M13", t:"加备份 PMS7003 + MQ-135", done:true},
      {c:"M14", t:"防水盒、气流与户外安装", current:true},
    ]},
    { s:"S4", t:"数据处理与 EPA NowCast", items:[
      {c:"M15", t:"数据格式化：UTC + Plantower CF=1", locked:true},
      {c:"M16", t:"NowCast 移动加权算法", locked:true},
      {c:"M17", t:"绘图：matplotlib 第一张 AQI 图", locked:true},
    ]},
  ], []);

  return (
    <main style={{display:"grid", gridTemplateColumns: "300px 1fr " + (agentOpen?"360px":"56px"), height:"calc(100vh - 57px)"}}>
      {/* LEFT — module nav */}
      <aside style={{
        borderRight:"1px solid var(--border)",
        background:"var(--paper-2)",
        overflowY:"auto",
        display:"flex", flexDirection:"column"
      }}>
        <div style={{padding:"16px 18px", borderBottom:"1px solid var(--border)"}}>
          <button onClick={()=>go("project")}
            style={{border:0, background:"transparent", padding:0, color:"var(--sub)", fontSize: 12, display:"inline-flex", alignItems:"center", gap: 6, cursor:"pointer"}}>
            <Icon name="chevron-left" size={13}/> Project home
          </button>
          <div style={{marginTop: 10, fontSize: 14, fontWeight: 600, lineHeight: 1.3, letterSpacing:"-.015em"}}>
            {project.title}
          </div>
          <div className="mono" style={{fontSize: 10.5, color:"var(--sub-2)", marginTop:4}}>{project.slug}</div>
          <div style={{marginTop: 12}}>
            <div style={{display:"flex", justifyContent:"space-between", fontSize: 10.5, color:"var(--sub)", fontFamily:"var(--mono)", marginBottom: 5}}>
              <span>13 / 30</span><span>47%</span>
            </div>
            <div className="bar violet"><i style={{width:"47%"}}/></div>
          </div>
        </div>

        {/* search */}
        <div style={{padding:"10px 14px", borderBottom:"1px solid var(--border)"}}>
          <div className="kbar" style={{minWidth: 0, width:"100%", height: 30, padding:"0 8px 0 10px", background:"var(--card)", borderColor:"var(--border)"}}>
            <Icon name="search" size={13}/>
            <span style={{fontSize: 12}}>Search modules…</span>
          </div>
        </div>

        {/* modules */}
        <div style={{flex:1, padding:"4px 0 30px"}}>
          {modules.map(sec => (
            <div key={sec.s} style={{paddingTop: 14}}>
              <div style={{display:"flex", justifyContent:"space-between", padding:"4px 18px", color:"var(--sub-2)"}}>
                <span className="mono" style={{fontSize: 10.5, letterSpacing:".06em"}}>{sec.s} · {sec.t}</span>
              </div>
              {sec.items.map(m=>{
                const active = m.c === activeM;
                return (
                  <button key={m.c} onClick={()=> !m.locked && setActiveM(m.c)}
                    style={{
                      display:"grid", gridTemplateColumns:"auto auto 1fr",
                      gap: 10, alignItems:"center", width:"100%",
                      padding:"8px 18px",
                      border: 0, background: active ? "var(--card)" : "transparent",
                      borderLeft: active ? "2px solid var(--violet)" : "2px solid transparent",
                      cursor: m.locked ? "default" : "pointer",
                      textAlign:"left",
                      opacity: m.locked ? .6 : 1,
                    }}>
                    <Icon name={m.done?"circle-check":m.current?"circle-dot":m.locked?"lock":"circle"} size={14}
                      style={{color: m.done?"var(--emerald)":m.current?"var(--violet)":m.locked?"var(--sub-2)":"var(--sub-2)"}}/>
                    <span className="mono" style={{fontSize: 10.5, color:"var(--sub-2)", width: 24}}>{m.c}</span>
                    <span style={{fontSize: 12.5, color: active?"var(--ink)":m.done?"var(--sub)":"var(--ink-2)", lineHeight:1.35, fontWeight: active? 600 : 400}}>{m.t}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </aside>

      {/* CENTER — content */}
      <section style={{overflowY:"auto", display:"flex", flexDirection:"column", background:"var(--paper)"}}>
        {/* sticky header */}
        <div style={{
          position:"sticky", top:0, background:"var(--paper)", zIndex: 5,
          padding:"14px 36px", borderBottom:"1px solid var(--border)",
          display:"flex", alignItems:"center", justifyContent:"space-between", gap: 14
        }}>
          <div style={{display:"flex", alignItems:"center", gap: 10}}>
            <span className="tag violet">S3 · M14</span>
            <span className="tag" style={{background:"var(--paper-2)"}}>
              <Icon name="clock" size={11}/> est. 55 min
            </span>
            <span className="tag" style={{background:"var(--paper-2)"}}>
              <Icon name="layers" size={11}/> 4 concepts
            </span>
          </div>
          <div style={{display:"flex", gap: 8}}>
            <button className="btn btn-ghost btn-sm"><Icon name="chevron-left" size={13}/> M13</button>
            <button className="btn btn-ghost btn-sm">M15 <Icon name="chevron-right" size={13}/></button>
            <button className="btn btn-violet btn-sm"><Icon name="check" size={13}/> Mark complete</button>
          </div>
        </div>

        {/* article */}
        <article style={{padding:"32px 56px 64px", maxWidth: 760, margin:"0 auto", width:"100%"}}>
          <div className="mono" style={{fontSize: 11, color:"var(--sub)"}}>S3 · M14</div>
          <h1 style={{fontSize: 32, lineHeight: 1.15, letterSpacing:"-.025em", marginTop: 8, fontWeight:600}}>
            防水盒、气流与户外安装
          </h1>
          <p className="body" style={{fontSize: 15, color:"var(--sub)", maxWidth: 620, marginTop: 10, lineHeight:1.55}}>
            户外节点不是把电路板塞进盒子。盒子要透气但不进水，安装高度、朝向、气流都决定数据能否被官方网络接受。
          </p>

          {/* audio chip */}
          <div style={{
            marginTop: 22, display:"flex", alignItems:"center", gap: 12,
            padding:"10px 14px", border:"1px solid var(--violet-line)", borderRadius: 9,
            background: "var(--violet-soft)"
          }}>
            <button style={{
              width: 32, height: 32, borderRadius:999, border:0, background:"var(--violet)",
              color:"#fff", display:"grid", placeItems:"center", cursor:"pointer"
            }}>
              <Icon name="play" size={13}/>
            </button>
            <div style={{flex: 1}}>
              <div style={{fontSize: 12.5, fontWeight: 600, color:"var(--violet-ink)"}}>音频讲解 · 6:12</div>
              <div className="mono" style={{fontSize: 10.5, color:"var(--violet-ink)", opacity:.65}}>cn-zh</div>
            </div>
            <button className="btn btn-ghost btn-sm" style={{background:"#fff"}}><Icon name="sparkles" size={12}/> Regenerate</button>
          </div>

          {/* heading */}
          <h2 style={{marginTop: 36, fontSize: 19, fontWeight: 600, letterSpacing:"-.015em"}}>
            这一节回答 3 个问题
          </h2>
          <div style={{
            marginTop: 10, padding:"12px 16px",
            background:"var(--card)", border:"1px solid var(--border)", borderRadius: 8,
            fontSize: 14, lineHeight: 1.55, color:"var(--ink-2)"
          }}>
            <ol style={{paddingLeft: 20, margin: 0}}>
              <li>盒子要透气还是密封？</li>
              <li>PMS5003 进气口朝下还是朝上？</li>
              <li>EPA 站点要 2–15m 高度，你家阳台合格吗？</li>
            </ol>
          </div>

          <h2 style={{marginTop: 32, fontSize: 19, fontWeight: 600, letterSpacing:"-.015em"}}>
            被动 vs 主动进气
          </h2>
          <p className="body" style={{fontSize: 14.5, lineHeight:1.65, marginTop: 10}}>
            被动进气靠盒子开孔自然通风 — 阳光晒到盒子，盒内会比外面热 4–8°C，PM2.5 读数会偏低 12–18%。主动进气用一个 5V 小风扇持续抽气，温漂更小，但需要持续供电。
          </p>

          <div className="card" style={{padding: 16, marginTop: 18, display:"grid", gridTemplateColumns:"1fr 1fr", gap: 14}}>
            <div>
              <div className="mono" style={{fontSize: 10.5, color:"var(--sub)"}}>OPTION A</div>
              <div style={{fontSize: 13.5, fontWeight:600, marginTop:4}}>百叶箱（被动）</div>
              <div style={{display:"flex", gap: 6, marginTop: 10}}>
                <span className="tag emerald">$0</span>
                <span className="tag">0 W</span>
                <span className="tag">±6%</span>
              </div>
            </div>
            <div>
              <div className="mono" style={{fontSize: 10.5, color:"var(--sub)"}}>OPTION B</div>
              <div style={{fontSize: 13.5, fontWeight:600, marginTop:4}}>5V 风扇（主动）</div>
              <div style={{display:"flex", gap: 6, marginTop: 10}}>
                <span className="tag">$4</span>
                <span className="tag amber">0.6 W</span>
                <span className="tag emerald">±3%</span>
              </div>
            </div>
          </div>

          <h2 style={{marginTop: 36, fontSize: 19, fontWeight: 600, letterSpacing:"-.015em"}}>
            安装示意图
          </h2>

          <Diagram/>

          {/* check question */}
          <div style={{
            marginTop: 24, border:"1px solid var(--violet-line)", borderRadius: 9,
            padding:"16px 18px", background:"var(--violet-soft)"
          }}>
            <div className="eyebrow" style={{color:"var(--violet-ink)", marginBottom:6}}>
              <span className="dot"/> Checkpoint
            </div>
            <div style={{fontSize: 14.5, fontWeight:600, color:"var(--violet-ink)"}}>
              1 楼阳台距地面 3m — EPA 站点接受吗？
            </div>
            <div style={{display:"flex", flexDirection:"column", gap: 6, marginTop: 12}}>
              {[
                {a:"接受，2–15m 都行",  ok:true},
                {a:"不接受，太低了"},
                {a:"接受，但要朝南"},
                {a:"取决于风向"},
              ].map((o,i)=>(
                <button key={i} style={{
                  display:"flex", alignItems:"center", gap: 10,
                  padding:"9px 11px", border:"1px solid #fff", background:"#fff",
                  borderRadius: 7, textAlign:"left", cursor:"pointer", fontSize: 13
                }}>
                  <span className="mono" style={{
                    width: 18, height: 18, borderRadius: 4,
                    border: "1px solid var(--border-2)", color:"var(--sub)",
                    display:"grid", placeItems:"center", fontSize: 10
                  }}>{String.fromCharCode(65+i)}</span>
                  {o.a}
                  {o.ok && <span className="tag emerald" style={{marginLeft:"auto"}}>correct</span>}
                </button>
              ))}
            </div>
          </div>

          {/* concept chip */}
          <h2 style={{marginTop: 36, fontSize: 19, fontWeight: 600, letterSpacing:"-.015em"}}>
            学到的概念
          </h2>
          <div style={{display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap: 8, marginTop: 12}}>
            <ConceptPill t="Stevenson screen" type="pattern"/>
            <ConceptPill t="温度漂移" type="data-quality"/>
            <ConceptPill t="EPA siting" type="standard"/>
            <ConceptPill t="百叶箱" type="pattern"/>
          </div>

          {/* footer nav */}
          <div style={{
            marginTop: 48, paddingTop: 18, borderTop: "1px solid var(--border)",
            display:"flex", justifyContent:"space-between", alignItems:"center"
          }}>
            <button className="btn btn-ghost">
              <Icon name="chevron-left" size={14}/> M13
            </button>
            <span className="mono" style={{fontSize: 10.5, color:"var(--sub)"}}>saved 4s ago</span>
            <button className="btn btn-violet">
              M15 <Icon name="arrow-right" size={14}/>
            </button>
          </div>
        </article>
      </section>

      {/* RIGHT — AI tutor */}
      <aside style={{
        borderLeft:"1px solid var(--border)",
        background: "var(--card)",
        display:"flex", flexDirection:"column",
        overflow: "hidden"
      }}>
        {agentOpen ? (
          <AgentPanel onClose={()=>setAgentOpen(false)}/>
        ) : (
          <button onClick={()=>setAgentOpen(true)} style={{
            width: 56, padding: "16px 0", border: 0, background:"transparent",
            display:"flex", flexDirection:"column", alignItems:"center", gap: 12,
            cursor:"pointer", color:"var(--sub)"
          }}>
            <Icon name="chevron-left" size={14}/>
            <Icon name="bot" size={18} style={{color:"var(--violet)"}}/>
          </button>
        )}
      </aside>
    </main>
  );
}

function Diagram() {
  return (
    <div style={{
      marginTop: 16, border:"1px solid var(--border)", borderRadius: 10,
      background:"var(--card)", padding: 24, position:"relative"
    }}>
      <svg viewBox="0 0 640 280" width="100%" height="280">
        {/* sky */}
        <defs>
          <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#F2EFFD"/>
            <stop offset="1" stopColor="#F5F3EE"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="640" height="200" fill="url(#sky)"/>
        <rect x="0" y="200" width="640" height="80" fill="#EEEAE0"/>

        {/* sun */}
        <circle cx="80" cy="50" r="14" fill="none" stroke="#D97757" strokeWidth="1.4"/>
        {[0,45,90,135,180,225,270,315].map((d,i)=>(
          <line key={i} x1={80} y1={50}
            x2={80 + 22*Math.cos(d*Math.PI/180)}
            y2={50 + 22*Math.sin(d*Math.PI/180)}
            stroke="#D97757" strokeWidth="1" opacity=".6"/>
        ))}

        {/* mounting pole */}
        <rect x="312" y="100" width="4" height="160" fill="#6E6E73"/>
        <rect x="280" y="260" width="68" height="6" fill="#6E6E73"/>

        {/* the box: louvered Stevenson screen */}
        <g transform="translate(220, 100)">
          <rect x="0" y="0" width="180" height="100" rx="6" fill="#fff" stroke="#2A2A2E" strokeWidth="1.5"/>
          {/* louvers */}
          {[14, 28, 42, 56, 70, 84].map((y,i)=>(
            <line key={i} x1="14" x2="166" y1={y} y2={y} stroke="#2A2A2E" strokeWidth="0.8"/>
          ))}
          {/* inlet arrow at bottom center */}
          <path d="M90 110 v8 m-5 -5 l5 5 l5 -5" stroke="#D97757" strokeWidth="1.8" fill="none"/>
          <text x="120" y="120" fontFamily="JetBrains Mono" fontSize="9" fill="#D97757">下进气</text>
          <text x="-2" y="-8" fontFamily="JetBrains Mono" fontSize="10" fill="#2A2A2E">Stevenson screen (simplified)</text>
        </g>

        {/* dimension lines */}
        <g stroke="#9A9A9F" strokeWidth=".7">
          <line x1="430" y1="100" x2="430" y2="260"/>
          <line x1="426" y1="100" x2="434" y2="100"/>
          <line x1="426" y1="260" x2="434" y2="260"/>
        </g>
        <text x="438" y="184" fontFamily="JetBrains Mono" fontSize="10" fill="#6E6E73">
          mounting h
        </text>
        <text x="438" y="198" fontFamily="JetBrains Mono" fontSize="11" fill="#2A2A2E" fontWeight="600">
          2 – 15 m
        </text>

        {/* wind arrow */}
        <g transform="translate(140, 140)">
          <path d="M0 0 h60 m-6 -6 l6 6 l-6 6" stroke="#A67B5B" strokeWidth="1.4" fill="none"/>
          <text x="0" y="-8" fontFamily="JetBrains Mono" fontSize="10" fill="#A67B5B">prevailing wind</text>
        </g>

        {/* label inlet detail */}
        <g transform="translate(440, 60)">
          <line x1="0" y1="60" x2="-50" y2="80" stroke="#9A9A9F" strokeWidth=".7"/>
          <text x="0" y="42" fontFamily="JetBrains Mono" fontSize="10" fill="#2A2A2E">PMS5003 进气</text>
          <text x="0" y="56" fontFamily="JetBrains Mono" fontSize="9.5" fill="#6E6E73">朝下 · 防雨</text>
        </g>

        {/* legend */}
        <g transform="translate(20, 240)" fontFamily="JetBrains Mono" fontSize="10" fill="#6E6E73">
          <text x="0" y="0">FIG. M14·1 — outdoor mounting layout. not to scale.</text>
        </g>
      </svg>
    </div>
  );
}

function ConceptPill({ t, type, link }) {
  return (
    <div style={{
      padding: 12, border:"1px solid var(--border)", borderRadius: 9, background:"var(--paper)",
      display:"flex", justifyContent:"space-between", alignItems:"center"
    }}>
      <div>
        <div style={{fontSize: 13.5, fontWeight: 600}}>{t}</div>
        <div className="mono" style={{fontSize: 10.5, color:"var(--sub)", marginTop: 3}}>{type}</div>
      </div>
      <Icon name="arrow-up-right" size={13} style={{color:"var(--sub)"}}/>
    </div>
  );
}

function AgentPanel({ onClose }) {
  const [input, setInput] = useState("");
  const msgs = [
    { who:"user",  t:"为什么进气口朝下不会进水？" },
    { who:"bot",
      t:"PurpleAir PA-II 进气口朝下，外面套 30mm PVC 三通管。3 个好处：",
      bullets:[
        "雨水有重力 — 不会停在进气口",
        "颗粒物没有重力优先 — 风一吹照进",
        "鸟和蜘蛛 — 朝下少 90% 堵塞"
      ],
      ref: "PurpleAir Maintenance Notes 2021 §4.2"
    },
    { who:"user", t:"为什么不直接主动抽风？" },
    { who:"bot", t:"PurpleAir 测过 — 风扇版数据更准，但 6 个月有 12% 故障率。卖给医院学校太关键。\n\n你只装 1–4 个，自己换很容易，所以 M14 默认走 Option B。",
      sources:[
        {t:"PurpleAir Forum — 2022 fan A/B",  s:"reviewed"},
        {t:"M14 ·『风扇方案』推荐", s:"this project"},
      ]
    },
  ];
  return (
    <div style={{display:"flex", flexDirection:"column", height:"100%"}}>
      <div style={{padding:"14px 16px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between"}}>
        <div style={{display:"flex", alignItems:"center", gap: 10}}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, background:"#15131F",
            display:"grid", placeItems:"center", color:"#fff"
          }}><Icon name="bot" size={15}/></div>
          <div>
            <div style={{fontSize: 13, fontWeight: 600}}>AI 助教 · M14</div>
            <div className="mono" style={{fontSize: 10.5, color: "var(--sub)"}}>scoped to this module · 4 tools</div>
          </div>
        </div>
        <button onClick={onClose} style={{border:0, background:"transparent", cursor:"pointer", color:"var(--sub)"}}>
          <Icon name="chevron-right" size={14}/>
        </button>
      </div>

      {/* scope chips */}
      <div style={{padding:"10px 16px", borderBottom:"1px solid var(--border)", display:"flex", flexWrap:"wrap", gap: 6}}>
        <span className="tag violet">M14 context</span>
        <span className="tag">PMS5003 docs</span>
        <span className="tag">PurpleAir notes</span>
        <span className="tag">EPA siting</span>
      </div>

      {/* messages */}
      <div style={{flex:1, overflowY:"auto", padding:"16px"}}>
        {msgs.map((m, i)=>(
          m.who === "user" ? (
            <div key={i} style={{display:"flex", justifyContent:"flex-end", marginBottom: 14}}>
              <div style={{
                background:"var(--paper-2)", padding:"8px 12px", borderRadius: 10,
                fontSize: 13, maxWidth: "85%"
              }}>{m.t}</div>
            </div>
          ) : (
            <div key={i} style={{marginBottom: 18}}>
              <div style={{display:"flex", alignItems:"center", gap: 6, color:"var(--sub)", fontSize: 11, marginBottom: 6}}>
                <Icon name="bot" size={12} style={{color:"var(--violet)"}}/>
                <span className="mono">assistant</span>
              </div>
              <div style={{fontSize: 13.5, lineHeight:1.55, color:"var(--ink-2)", whiteSpace:"pre-wrap"}}>{m.t}</div>
              {m.bullets && (
                <ol style={{paddingLeft: 18, marginTop: 8, fontSize: 13, color:"var(--ink-2)", lineHeight:1.55}}>
                  {m.bullets.map((b, k)=><li key={k} style={{marginBottom: 4}}>{b}</li>)}
                </ol>
              )}
              {m.ref && (
                <div style={{marginTop: 8, padding:"6px 10px", background:"var(--paper)", border:"1px solid var(--border)", borderRadius: 6, fontFamily:"var(--mono)", fontSize: 10.5, color:"var(--sub)"}}>
                  source · {m.ref}
                </div>
              )}
              {m.sources && (
                <div style={{marginTop: 10, display:"flex", flexDirection:"column", gap:6}}>
                  {m.sources.map((s,k)=>(
                    <div key={k} style={{
                      display:"flex", justifyContent:"space-between",
                      padding:"6px 10px", background:"var(--paper)", border:"1px solid var(--border)",
                      borderRadius: 6, fontSize: 11.5
                    }}>
                      <span style={{color: "var(--ink-2)"}}>{s.t}</span>
                      <span className="mono" style={{color: "var(--sub)"}}>{s.s}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        ))}

        {/* suggestion chips */}
        <div style={{marginTop: 12, display:"flex", flexDirection:"column", gap: 6}}>
          <SuggestChip t="把 PMS5003 datasheet 第 8 页画给我看"/>
          <SuggestChip t="EPA siting criteria 全文链接？"/>
          <SuggestChip t="生成一个 5V 风扇接 GPIO 12 的 wiring diagram"/>
        </div>
      </div>

      {/* input */}
      <div style={{borderTop:"1px solid var(--border)", padding:"12px 14px"}}>
        <div style={{
          display:"flex", alignItems:"center", gap: 8,
          padding:"8px 10px", border:"1px solid var(--border-2)", borderRadius: 8, background:"var(--paper)"
        }}>
          <Icon name="sparkles" size={13} style={{color:"var(--violet)"}}/>
          <input value={input} onChange={e=>setInput(e.target.value)}
            placeholder="问点什么 · scoped to M14"
            style={{flex:1, border:0, background:"transparent", outline:"none", fontSize: 13}}/>
          <button style={{border:0, background:"var(--ink)", color:"#fff", borderRadius: 6, padding:"5px 8px", cursor:"pointer"}}>
            <Icon name="arrow-up-right" size={12}/>
          </button>
        </div>
        <div className="mono" style={{fontSize: 10, color:"var(--sub-2)", marginTop: 8, display:"flex", justifyContent:"space-between"}}>
          <span>haiku-4.5 · 1024 token cap</span>
          <span>142 runs this week</span>
        </div>
      </div>
    </div>
  );
}

function SuggestChip({ t }) {
  return (
    <button style={{
      textAlign:"left", padding:"7px 10px",
      background:"var(--paper)", border:"1px dashed var(--border-2)", borderRadius: 7,
      fontSize: 12, color:"var(--sub)", cursor:"pointer", display:"flex", gap: 8, alignItems:"center"
    }}>
      <Icon name="sparkles" size={11} style={{color:"var(--violet)"}}/>
      {t}
    </button>
  );
}

window.ProjectLearn = ProjectLearn;
