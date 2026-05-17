const { useState, useEffect, useMemo, useRef, useCallback } = React;

/* Top navigation shared across pages */
function TopNav({ page, setPage }) {
  const tabs = [
    { id: "home",    label: "Home",       icon: "home",       to: "dashboard"  },
    { id: "library", label: "Library",    icon: "library",    to: "library"    },
    { id: "projects",label: "My Projects",icon: "git-branch", to: "myprojects" },
  ];
  return (
    <header className="topnav">
      <a className="brand" href="#" onClick={(e)=>{e.preventDefault(); setPage("landing");}}>
        <span className="brand-mark"><span>SE</span></span>
        <span>SystemEdu</span>
        <span style={{
          fontFamily: "var(--mono)", fontSize: 10.5, padding: "2px 6px",
          background: "var(--paper-2)", borderRadius: 4, color: "var(--sub)",
          marginLeft: 2, border: "1px solid var(--border)"
        }}>v2.4</span>
      </a>

      <nav className="nav-tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={"nav-tab " + (
              (t.id==="home" && page==="dashboard") ||
              (t.id==="library" && page==="library") ||
              (t.id==="projects" && (page==="myprojects" || page==="project" || page==="learn"))
              ? "active" : ""
            )}
            onClick={() => setPage(t.to)}
          >
            <Icon name={t.icon} size={15} />
            {t.label}
          </button>
        ))}
      </nav>

      <div className="nav-spacer" />

      <div className="kbar">
        <Icon name="search" size={15} />
        <span>Search projects, modules, concepts…</span>
        <span className="kbd"><Icon name="command" size={10} style={{verticalAlign:-1}}/> K</span>
      </div>

      <button className="btn btn-ghost btn-sm" style={{height:32}}>
        <Icon name="sparkles" size={14}/> Assistant
      </button>

      <div className="user-chip">
        <span className="avatar">XH</span>
        xinghan
        <Icon name="chevron-down" size={13}/>
      </div>
    </header>
  );
}
window.TopNav = TopNav;

/* Tiny breadcrumb */
function Crumbs({ items }) {
  return (
    <div style={{display:"flex", alignItems:"center", gap:8, color:"var(--sub)", fontSize:12.5}}>
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i>0 && <Icon name="chevron-right" size={12} style={{color:"var(--sub-2)"}}/>}
          <span style={{
            color: i===items.length-1 ? "var(--ink-2)" : "var(--sub)",
            fontFamily: it.mono ? "var(--mono)" : "inherit"
          }}>{it.label}</span>
        </React.Fragment>
      ))}
    </div>
  );
}
window.Crumbs = Crumbs;

/* Decorative striped placeholder */
function Stripes({ height = 180, label = "image", subtle, color = "var(--paper-2)" }) {
  return (
    <div style={{
      position:"relative",
      width:"100%", height,
      borderRadius: 8,
      background: `repeating-linear-gradient(135deg, ${color} 0 12px, transparent 12px 24px), var(--paper)`,
      border:"1px solid var(--border)",
      overflow:"hidden"
    }}>
      <div style={{
        position:"absolute", left: 12, bottom: 10,
        fontFamily:"var(--mono)", fontSize: 11, color: "var(--sub)",
        padding: "3px 7px", background:"rgba(255,255,255,.85)", borderRadius:5,
        border: "1px solid var(--border)"
      }}>{label}</div>
      {subtle && <div style={{position:"absolute", inset:0, background:"linear-gradient(0deg, rgba(0,0,0,.04), transparent 40%)"}}/>}
    </div>
  );
}
window.Stripes = Stripes;

/* Main App router */
function App() {
  const [page, setPage] = useState("landing"); // landing, dashboard, library, myprojects, project, learn
  const [treeOpen, setTreeOpen] = useState(false);

  // Shared "selected project" for cross-page nav
  const [project] = useState({
    id: "purpleair-airquality-node",
    title: "接入 PurpleAir / OpenAQ 的空气质量节点",
    subtitle: "运行 EPA NowCast — 用 Raspberry Pi 拼一个能被官方网络收录的空气质量站点",
    slug: "purpleair-airquality-node",
    domain: "Climate",
    age: "10–12 yr",
    weeks: 26,
    difficulty: 3,
    sections: 6,
    modules: 30,
    cost: "≈ $180 USD",
  });

  const openTree = () => setTreeOpen(true);
  const closeTree = () => setTreeOpen(false);

  return (
    <div className="app">
      <TopNav page={page} setPage={setPage} />
      {page === "landing"   && <Homepage    go={setPage} />}
      {page === "dashboard" && <Dashboard   go={setPage} project={project} openTree={openTree}/>}
      {page === "library"   && <Library     go={setPage} project={project}/>}
      {page === "myprojects"&& <MyProjects  go={setPage} project={project}/>}
      {page === "project"   && <ProjectHome go={setPage} project={project} openTree={openTree}/>}
      {page === "learn"     && <ProjectLearn go={setPage} project={project} openTree={openTree}/>}

      {treeOpen && (
        <div style={{
          position:"fixed", inset: 0, zIndex: 200,
          background:"rgba(8,9,14,.45)",
          backdropFilter:"blur(4px)",
          display:"flex", flexDirection:"column"
        }}
        onClick={(e)=>{ if (e.target === e.currentTarget) closeTree(); }}>
          <div style={{
            margin: "32px",
            flex: 1, minHeight: 0,
            background:"var(--paper)",
            border:"1px solid var(--border)",
            borderRadius: 14,
            overflow:"hidden",
            display:"flex", flexDirection:"column",
            boxShadow:"0 30px 60px -20px rgba(0,0,0,.4)"
          }}>
            <KnowledgeTree project={project} onClose={closeTree} go={(p)=>{ closeTree(); setPage(p); }}/>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
