/* MyProjects — list of projects the user has forked */
function MyProjects({ go, project }) {
  const [view, setView] = useState("grid"); // grid | list
  const [filter, setFilter] = useState("active");

  const forks = [
    { id:"purpleair", title:"PurpleAir / OpenAQ 空气质量节点", slug:"purpleair-airquality-node",
      tag:"Climate", cover:"climate", color:"climate",
      forkedDays:91, lastDays:0, progress:47, modules:"13/30", weeks:26,
      status:"active", current:"M14 · 防水盒、气流与户外安装", uptime:"99.4%" },
    { id:"cubesat", title:"437.4 MHz cubesat 地面站", slug:"cubesat-groundstation",
      tag:"Aerospace", cover:"space", color:"aerospace",
      forkedDays:62, lastDays:5, progress:22, modules:"4/18", weeks:18,
      status:"active", current:"M05 · UHF Yagi 天线建模" },
    { id:"lora", title:"LoRa 末梢气象站集群", slug:"lora-weather-mesh",
      tag:"Climate", cover:"climate", color:"climate",
      forkedDays:14, lastDays:9, progress:8, modules:"2/14", weeks:14,
      status:"paused", current:"M02 · LoRa 调制基础" },
    { id:"micro", title:"家用微塑料目视计数管线", slug:"microplastic-counter",
      tag:"Bioscience", cover:"bio", color:"bio",
      forkedDays:142, lastDays:0, progress:100, modules:"12/12", weeks:12,
      status:"shipped", current:null, submitted:"Mar 18, 2026" },
  ];

  const groups = {
    active:  forks.filter(f => f.status==="active"),
    paused:  forks.filter(f => f.status==="paused"),
    shipped: forks.filter(f => f.status==="shipped"),
  };
  const filtered = filter==="all" ? forks : groups[filter] || [];

  return (
    <main className="page-wide" style={{paddingTop: 20}}>
      <Crumbs items={[{label:"Home"}, {label:"My Projects"}]} />

      <div style={{display:"flex", alignItems:"flex-end", justifyContent:"space-between", margin:"12px 0 20px"}}>
        <div>
          <div className="eyebrow" style={{marginBottom: 8}}><span className="dot"/> 4 forks · 1 shipped</div>
          <h1 className="h1" style={{fontSize: 30}}>My projects</h1>
        </div>
        <div style={{display:"flex", gap: 10}}>
          <button className="btn btn-ghost" onClick={()=>go("library")}><Icon name="library" size={14}/> Library</button>
          <button className="btn btn-violet" onClick={()=>go("library")}><Icon name="git-fork" size={14}/> Fork new</button>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap: 0, border:"1px solid var(--border)", borderRadius: 10, overflow:"hidden", background:"var(--card)", marginBottom: 20}}>
        <MiniStat label="Forked"    value="4"     sub="all-time"/>
        <MiniStat label="Active"    value="2"     sub="updated this week"/>
        <MiniStat label="Modules"   value="31/74" sub="42% across all forks"/>
        <MiniStat label="Shipped"   value="1"     sub="microplastic-counter" last/>
      </div>

      {/* Filter rail */}
      <div style={{display:"flex", alignItems:"center", gap: 4, marginBottom: 18, paddingBottom: 12, borderBottom:"1px solid var(--border)"}}>
        <FilterTab id="active"  current={filter} onClick={setFilter} label="Active"  n={groups.active.length}/>
        <FilterTab id="paused"  current={filter} onClick={setFilter} label="Paused"  n={groups.paused.length}/>
        <FilterTab id="shipped" current={filter} onClick={setFilter} label="Shipped" n={groups.shipped.length}/>
        <FilterTab id="all"     current={filter} onClick={setFilter} label="All"     n={forks.length}/>
        <div style={{flex:1}}/>
        <button className={"nav-tab " + (view==="grid"?"active":"")} onClick={()=>setView("grid")}>
          <Icon name="grid" size={13}/> Grid
        </button>
        <button className={"nav-tab " + (view==="list"?"active":"")} onClick={()=>setView("list")}>
          <Icon name="menu" size={13}/> List
        </button>
      </div>

      {view==="grid" ? (
        <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap: 14}}>
          {filtered.map(f => <ForkCard key={f.id} f={f} onOpen={f.id==="purpleair"?()=>go("project"):null} onLearn={f.id==="purpleair"?()=>go("learn"):null}/>)}
        </div>
      ) : (
        <div className="card" style={{padding:0, overflow:"hidden"}}>
          <ForkListHead/>
          {filtered.map((f, i) => <ForkListRow key={f.id} f={f} last={i===filtered.length-1} onOpen={f.id==="purpleair"?()=>go("project"):null}/>)}
        </div>
      )}

      {/* Empty state for filters with nothing */}
      {filtered.length===0 && (
        <div style={{padding:48, textAlign:"center", border:"1px dashed var(--border-2)", borderRadius: 12}}>
          <div style={{color:"var(--sub)", fontSize:13}}>Nothing here yet.</div>
          <button className="btn btn-ghost btn-sm" style={{marginTop: 12}} onClick={()=>setFilter("all")}>Show all</button>
        </div>
      )}
    </main>
  );
}

function MiniStat({ label, value, sub, last }) {
  return (
    <div style={{padding:"14px 18px", borderRight: last?"0":"1px solid var(--border)"}}>
      <div className="mono" style={{fontSize:11, color:"var(--sub)", letterSpacing:".02em"}}>{label.toUpperCase()}</div>
      <div style={{fontSize: 22, fontWeight: 600, letterSpacing:"-.02em", marginTop: 4}}>{value}</div>
      <div className="mono" style={{fontSize: 10.5, color:"var(--sub)", marginTop: 3}}>{sub}</div>
    </div>
  );
}

function FilterTab({ id, label, n, current, onClick }) {
  return (
    <button onClick={()=>onClick(id)} className={"nav-tab " + (current===id ? "active":"")}>
      {label} <span style={{color:"var(--sub-2)", fontSize:11, marginLeft:4, fontFamily:"var(--mono)"}}>{n}</span>
    </button>
  );
}

function statusPip(s) {
  if (s==="active")  return <span className="pip run">ACTIVE</span>;
  if (s==="paused")  return <span className="pip warn">PAUSED</span>;
  if (s==="shipped") return <span className="pip ok">SHIPPED</span>;
  return null;
}

function ForkCard({ f, onOpen, onLearn }) {
  return (
    <div style={{border:"1px solid var(--border)", borderRadius:12, background:"var(--card)", overflow:"hidden", display:"flex", flexDirection:"column", cursor: onOpen?"pointer":"default"}}
         onClick={onOpen}>
      <div style={{position:"relative"}}>
        <CoverArt kind={f.cover}/>
        <div style={{position:"absolute", top: 12, right: 12}}>
          {statusPip(f.status)}
        </div>
      </div>
      <div style={{padding: 16, display:"flex", flexDirection:"column", gap: 8, flex:1}}>
        <div style={{display:"flex", gap: 6, alignItems:"center"}}>
          <span className={"tag " + f.color}>{f.tag}</span>
          <span className="tag">{f.weeks}w</span>
        </div>
        <div className="mono" style={{color:"var(--sub-2)", fontSize: 11}}>{f.slug}</div>
        <h3 className="h3" style={{fontSize: 15, lineHeight:1.35}}>{f.title}</h3>

        {/* progress block */}
        {f.status !== "shipped" ? (
          <div style={{marginTop: 4}}>
            <div style={{display:"flex", justifyContent:"space-between", fontSize: 11, color:"var(--sub)", fontFamily:"var(--mono)", marginBottom: 5}}>
              <span>{f.modules}</span>
              <span>{f.progress}%</span>
            </div>
            <div className="bar violet"><i style={{width: f.progress + "%"}}/></div>
            <div className="mono" style={{fontSize: 11, color: f.status==="paused"?"var(--amber)":"var(--ink-2)", marginTop: 8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
              {f.status==="paused" ? "paused · " : "next · "}{f.current}
            </div>
          </div>
        ) : (
          <div style={{marginTop: 4, padding: "10px 12px", background:"var(--emerald-soft)", border:"1px solid #BCDBC9", borderRadius: 7}}>
            <div style={{display:"flex", alignItems:"center", gap: 6, color:"#0E5A38", fontSize:12.5, fontWeight: 600}}>
              <Icon name="check" size={13}/> Submitted upstream
            </div>
            <div className="mono" style={{fontSize: 10.5, color:"#0E5A38", marginTop: 3, opacity:.8}}>{f.submitted}</div>
          </div>
        )}

        <div style={{flex:1}}/>
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", paddingTop: 10, borderTop:"1px dashed var(--border)"}}>
          <span className="mono" style={{fontSize: 10.5, color:"var(--sub)"}}>
            forked {f.forkedDays}d ago · {f.lastDays===0?"today":f.lastDays+"d ago"}
          </span>
          {onLearn ? (
            <button onClick={(e)=>{e.stopPropagation(); onLearn();}} className="btn btn-violet btn-sm">
              Continue <Icon name="arrow-right" size={12}/>
            </button>
          ) : (
            <span style={{color:"var(--violet)", fontSize: 12.5, display:"inline-flex", alignItems:"center", gap:4}}>
              Open <Icon name="arrow-right" size={12}/>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ForkListHead() {
  return (
    <div style={{
      display:"grid", gridTemplateColumns: "1.6fr 100px 1fr 120px 90px 80px",
      gap: 12, padding: "10px 18px", fontFamily:"var(--mono)", fontSize: 10.5,
      color:"var(--sub)", letterSpacing:".05em", borderBottom: "1px solid var(--border)"
    }}>
      <span>PROJECT</span><span>DOMAIN</span><span>PROGRESS</span><span>STATUS</span><span style={{textAlign:"right"}}>LAST</span><span/>
    </div>
  );
}

function ForkListRow({ f, last, onOpen }) {
  return (
    <div onClick={onOpen} style={{
      display:"grid", gridTemplateColumns: "1.6fr 100px 1fr 120px 90px 80px",
      gap: 12, alignItems:"center",
      padding: "14px 18px",
      borderBottom: last?"0":"1px solid var(--border)",
      cursor: onOpen?"pointer":"default"
    }}>
      <div style={{minWidth:0}}>
        <div style={{fontSize: 13.5, fontWeight: 600, color:"var(--ink)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{f.title}</div>
        <div className="mono" style={{fontSize: 10.5, color:"var(--sub)", marginTop: 2}}>{f.slug}</div>
      </div>
      <span className={"tag " + f.color}>{f.tag}</span>
      <div>
        <div style={{display:"flex", justifyContent:"space-between", fontSize: 10.5, color:"var(--sub)", fontFamily:"var(--mono)", marginBottom: 4}}>
          <span>{f.modules}</span>
          <span>{f.progress}%</span>
        </div>
        <div className="bar violet"><i style={{width: f.progress + "%"}}/></div>
      </div>
      <span>{statusPip(f.status)}</span>
      <span className="mono" style={{fontSize: 10.5, color:"var(--sub)", textAlign:"right"}}>
        {f.lastDays===0?"today":f.lastDays+"d ago"}
      </span>
      <Icon name="arrow-right" size={13} style={{color:"var(--sub-2)", justifySelf:"end"}}/>
    </div>
  );
}

window.MyProjects = MyProjects;
