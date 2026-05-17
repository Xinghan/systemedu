/* Library — browse / filter / pick a project */
function Library({ go, project }) {
  const [filter, setFilter] = useState("All");
  const cats = ["All", "Climate", "Aerospace", "Bioscience", "Robotics", "Materials", "Energy", "Computing"];

  const projects = [
    { id:"purpleair", cover:"climate", title:"PurpleAir / OpenAQ 空气质量节点", slug:"purpleair-airquality-node", tag:"Climate", weeks:26, forks:1840, diff:3, blurb:"Run EPA NowCast. Join an open air-quality network.", featured:true},
    { id:"cubesat",   cover:"space",   title:"437.4 MHz cubesat 地面站", slug:"cubesat-groundstation", tag:"Aerospace", weeks:18, forks:612, diff:4, blurb:"UHF Yagi. AX.25 decode. Upload to SatNOGS."},
    { id:"micro",     cover:"bio",     title:"家用微塑料目视计数管线", slug:"microplastic-counter", tag:"Bioscience", weeks:12, forks:948, diff:3, blurb:"Microscope + OpenCV. Tea, salt, tap water."},
    { id:"lora",      cover:"climate", title:"LoRa 末梢气象站集群", slug:"lora-weather-mesh", tag:"Climate", weeks:14, forks:412, diff:3, blurb:"4-node LoRa mesh. No gateway. Local sqlite."},
    { id:"sourdough", cover:"bio",     title:"老面发酵的 16S 微生物测序", slug:"sourdough-16s", tag:"Bioscience", weeks:10, forks:230, diff:5, blurb:"DIY sampling → QIIME2 on 16S reads."},
    { id:"robot",     cover:"robot",   title:"ROS2 教 4-DOF 机械臂拣物", slug:"ros2-pickbot", tag:"Robotics", weeks:20, forks:780, diff:5, blurb:"PyTorch grasping policy on Jetson."},
  ];

  const filtered = filter === "All" ? projects : projects.filter(p => p.tag === filter);

  return (
    <main className="page-wide" style={{paddingTop: 20}}>
      <Crumbs items={[{label:"Home"},{label:"Library"}]} />

      <div style={{display:"flex", alignItems:"flex-end", justifyContent:"space-between", margin:"12px 0 20px"}}>
        <div>
          <div className="eyebrow" style={{marginBottom: 8}}><span className="dot"/> 124 projects · 8 domains</div>
          <h1 className="h1" style={{fontSize: 30}}>Project library</h1>
        </div>

        <div style={{display:"flex", gap: 10}}>
          <button className="btn btn-ghost"><Icon name="filter" size={14}/> Filters · 3</button>
          <button className="btn btn-ghost"><Icon name="grid" size={14}/> Grid</button>
        </div>
      </div>

      {/* Filter rail */}
      <div style={{display:"flex", alignItems:"center", gap: 4, marginBottom: 22, paddingBottom: 14, borderBottom:"1px solid var(--border)", flexWrap:"wrap"}}>
        {cats.map(c => (
          <button key={c}
            className={"nav-tab " + (filter===c ? "active" : "")}
            onClick={()=>setFilter(c)}>
            {c} {c!=="All" && <span style={{color:"var(--sub-2)", fontSize:11, marginLeft:4, fontFamily:"var(--mono)"}}>{c==="Climate"?18:c==="Aerospace"?12:c==="Bioscience"?22:c==="Robotics"?15:c==="Materials"?9:c==="Energy"?11:17}</span>}
          </button>
        ))}
        <div style={{flex:1}}/>
        <span className="mono" style={{fontSize: 11.5, color:"var(--sub)"}}>SORT</span>
        <button className="btn btn-ghost btn-sm">Most forked <Icon name="chevron-down" size={12}/></button>
      </div>

      {/* Project grid */}
      <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap: 14}}>
        {filtered.map((p, i) => (
          <ProjectCard key={p.id} p={p} onOpen={p.id==="purpleair" ? ()=>go("project") : null}/>
        ))}
      </div>

      {/* request a project */}
      <div style={{
        marginTop: 24, border:"1px dashed var(--border-2)", borderRadius: 10,
        padding: "18px 22px", display:"flex", alignItems:"center", justifyContent:"space-between"
      }}>
        <div>
          <h3 className="h3">Don't see what you need?</h3>
          <p className="body" style={{color:"var(--sub)", fontSize: 13, marginTop: 2}}>
            A mentor will scope it with an industry author.
          </p>
        </div>
        <button className="btn btn-ghost"><Icon name="plus" size={14}/> Request a project</button>
      </div>
    </main>
  );
}

function ProjectCard({ p, onOpen }) {
  return (
    <div onClick={onOpen}
         style={{padding:0, overflow:"hidden", display:"flex", flexDirection:"column", cursor: onOpen?"pointer":"default", border:"1px solid var(--border)", borderRadius:12, background:"var(--card)"}}>
      <CoverArt kind={p.cover}/>
      <div style={{padding: 18, display:"flex", flexDirection:"column", gap: 10, flex:1}}>
        <div style={{display:"flex", gap: 6, alignItems:"center"}}>
          <span className={"tag " + (
            p.tag==="Climate"?"climate":
            p.tag==="Aerospace"?"aerospace":
            p.tag==="Bioscience"?"bio":
            p.tag==="Robotics"?"robotics":
            "violet"
          )}>{p.tag}</span>
          <span className="tag">{p.weeks}w</span>
          <span className="tag">diff {p.diff}</span>
          {p.featured && <span className="tag ink">NEW v1.4.2</span>}
        </div>
        <div className="mono" style={{color:"var(--sub-2)", fontSize: 11}}>{p.slug}</div>
        <h3 className="h3" style={{fontSize: 16, lineHeight:1.35}}>{p.title}</h3>
        <p className="body" style={{fontSize: 13.5, color:"var(--sub)", flex:1}}>{p.blurb}</p>
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", paddingTop: 12, borderTop:"1px dashed var(--border)"}}>
          <span className="mono" style={{fontSize: 11, color:"var(--sub)", display:"inline-flex", gap: 10}}>
            <span><Icon name="git-fork" size={11} style={{verticalAlign:-1}}/> {p.forks.toLocaleString()}</span>
            <span><Icon name="star" size={11} style={{verticalAlign:-1}}/> {(p.forks*2.4|0).toLocaleString()}</span>
          </span>
          <span style={{color:"var(--violet)", fontSize:13, fontWeight:500, display:"inline-flex", alignItems:"center", gap:4}}>
            Open <Icon name="arrow-right" size={13}/>
          </span>
        </div>
      </div>
    </div>
  );
}

window.Library = Library;
