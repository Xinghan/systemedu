import { GRID, TARGETS, LANDER } from "./models.mjs";

// 同一份精细矢量设备图用于无 WebGL 的画面，不替代运行时照片。
export function vehicleSVG(kind) {
  const defs=`<defs><linearGradient id="gold" x2=".6" y2="1"><stop stop-color="#f3db92"/><stop offset=".34" stop-color="#b68c40"/><stop offset=".55" stop-color="#e6c46a"/><stop offset="1" stop-color="#80602a"/></linearGradient><linearGradient id="metal" x2=".7" y2="1"><stop stop-color="#f3f1de"/><stop offset=".35" stop-color="#aeb7b7"/><stop offset=".6" stop-color="#e8e7d9"/><stop offset="1" stop-color="#667577"/></linearGradient><linearGradient id="panel" x2="1" y2="1"><stop stop-color="#385779"/><stop offset="1" stop-color="#111e35"/></linearGradient><radialGradient id="glass"><stop stop-color="#709fb1"/><stop offset=".4" stop-color="#254e65"/><stop offset="1" stop-color="#081921"/></radialGradient><pattern id="cells" width="17" height="12" patternUnits="userSpaceOnUse"><rect width="17" height="12" fill="url(#panel)"/><path d="M0 0H17V12H0ZM3 2V10M13 2V10" fill="none" stroke="#8594a3" stroke-width=".45"/></pattern><pattern id="foil" width="18" height="19" patternUnits="userSpaceOnUse"><path d="m0 4 9 5 9-7M2 19 7-13m3 25 9-6" fill="none" stroke="#fff1b3" stroke-opacity=".22" stroke-width=".7"/></pattern></defs>`;
  let content="";
  if(kind==="lander") {
    content+=`<g stroke-linejoin="round"><path d="m165 143-63 82-13 1 12 8 15-6 63-70m58-11 66 78 13 1-11 8-14-5-66-72" fill="url(#metal)" stroke="#4e5d60" stroke-width="2"/><path d="m160 154-12 49-28 19m113-70 14 52 28 21" fill="none" stroke="#a7b3b1" stroke-width="5"/><ellipse cx="101" cy="232" rx="22" ry="7" fill="url(#metal)" stroke="#5d6867"/><ellipse cx="304" cy="234" rx="23" ry="8" fill="url(#metal)" stroke="#5d6867"/><path d="m180 177-9 30q28 13 54 0l-9-30" fill="#465052" stroke="#adb0a7" stroke-width="2"/><ellipse cx="198" cy="207" rx="27" ry="8" fill="#152429"/>
    <path d="m144 103 54-19 56 22v65l-54 26-56-27Z" fill="url(#gold)" stroke="#776635" stroke-width="2"/><path d="m145 113 55 20 53-19v57l-53 25-55-26Z" fill="url(#foil)"/><path d="m200 132 0 63m-38-73v55m78-56v57" stroke="#e3d6a1" stroke-width="2"/>
    <path d="m138 105 60-25 62 24-60 30Z" fill="url(#metal)" stroke="#647576" stroke-width="2"/><path d="m143 127-59-12m171 14 62-12" stroke="#8d9791" stroke-width="7"/>
    <path d="m14 99 83-34 61 37-82 38Z" fill="url(#cells)" stroke="#abb6ae" stroke-width="4"/><path d="m248 104 82-37 62 37-82 39Z" fill="url(#cells)" stroke="#abb6ae" stroke-width="4"/><path d="m52 84 63 39m175-37 61 39" stroke="#b7bbaa" stroke-width="2"/>
    <path d="m177 93 1-30 19-6 22 11v32l-21 8Z" fill="url(#metal)" stroke="#5a696a"/><circle cx="194" cy="82" r="8" fill="url(#glass)" stroke="#576263" stroke-width="3"/><path d="M229 92V36" stroke="#d3d4be" stroke-width="3"/><circle cx="229" cy="35" r="4" fill="#d6ccb0"/><path d="m230 72 19-26q-6 33-19 26" fill="url(#metal)" stroke="#606e71"/>
    <path d="m177 168-34 64-12 2 14 9 15-9 31-61m28-6 34 63 13 2-13 9-15-8-32-59" fill="url(#metal)" stroke="#58686a" stroke-width="2"/><ellipse cx="146" cy="241" rx="22" ry="7" fill="url(#metal)"/><ellipse cx="253" cy="241" rx="23" ry="7" fill="url(#metal)"/>
    <path d="m168 181-15 32m65-32 16 29" stroke="#c5a152" stroke-width="8"/>`;
    for(let i=0;i<7;i++) content+=`<circle cx="${154+i*14}" cy="${111+Math.min(i,6-i)*4}" r="2" fill="#59686b" stroke="#d9d9c5" stroke-width=".8"/>`;
    content+='</g>';
  } else {
    const wheel=(x,y,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})"><ellipse rx="24" ry="29" fill="#283438" stroke="#738081" stroke-width="3"/><ellipse rx="17" ry="23" fill="url(#metal)" stroke="#192d33" stroke-width="2"/>${Array.from({length:10},(_,i)=>{const a=i*Math.PI/5;return `<path d="M${Math.sin(a)*8} ${Math.cos(a)*10} ${Math.sin(a)*15} ${Math.cos(a)*21}" stroke="#526568" stroke-width="2"/>`;}).join('')}<ellipse rx="7" ry="9" fill="url(#gold)"/>${Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return `<path d="m${Math.sin(a)*23-2} ${Math.cos(a)*28-2} 5 4" stroke="#b0b6b0" stroke-width="2"/>`;}).join('')}</g>`;
    content+=wheel(267,177,.85)+wheel(212,150,.8)+wheel(137,145,.8);
    content+=`<path d="m90 152 150-23 58 32-144 27Z" fill="#38494c" stroke="#172b32" stroke-width="3"/><path d="m83 132 143-31 73 31v40l-145 36-71-32Z" fill="url(#gold)" stroke="#4c6062" stroke-width="2"/><path d="m83 147 71 39 145-35v20l-145 35-71-30Z" fill="url(#foil)"/><path d="m77 127 148-33 79 35-150 40Z" fill="url(#metal)" stroke="#5b7070" stroke-width="3"/><path d="m98 133 123-28 53 23-120 29Z" fill="#c7c7b4"/>`;
    for(let i=0;i<10;i++)content+=`<path d="m${190+i*5} ${113-i*.5} 24 11" stroke="#758684" stroke-width="2"/>`;
    content+=`<path d="m142 138 0-65 8-3 0 65Z" fill="url(#metal)" stroke="#5e7375"/><path d="m116 56 39-10 27 15v28l-41 9-25-15Z" fill="url(#metal)" stroke="#52686b" stroke-width="2"/><ellipse cx="130" cy="74" rx="8" ry="10" fill="url(#glass)" stroke="#425b64" stroke-width="3"/><ellipse cx="153" cy="72" rx="8" ry="10" fill="url(#glass)" stroke="#425b64" stroke-width="3"/><path d="M248 116V61" stroke="#c5c8b3" stroke-width="3"/><circle cx="248" cy="58" r="4" fill="#abb8b6"/><path d="m246 98 24-34q-4 45-24 34" fill="url(#metal)" stroke="#627675"/>
    <path d="m151 185-24 14-41-7m41 7 35 19 49-15m-49 15 65 7" fill="none" stroke="#25383e" stroke-width="11"/><path d="m151 185-24 14-41-7m41 7 35 19 49-15m-49 15 65 7" fill="none" stroke="url(#metal)" stroke-width="6"/>
    <path d="m87 162-39 22 26 16 36-6" fill="none" stroke="#a6b4b1" stroke-width="7"/>`;
    content+=wheel(82,201)+wheel(153,230)+wheel(233,213);
    for(let i=0;i<9;i++)content+=`<circle cx="${163+i*14}" cy="${164-i*3.25}" r="1.7" fill="#536669"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 410 280" width="820" height="560">${defs}${content}</svg>`;
}

export function createInstruments(root,kind) {
  const hud=document.createElement("div");hud.className="mission-instruments";
  if(kind==="lander")hud.innerHTML=`<div class="instrument-title">下降监测 <span>LIVE</span></div><svg class="descent-gauge" viewBox="0 0 186 124" role="img" aria-label="实时高度与制动监测"><defs><linearGradient id="height-color" x2="0" y2="1"><stop stop-color="#c5dfd3"/><stop offset="1" stop-color="#dfac70"/></linearGradient></defs><path d="M30 12V104H170" fill="none" stroke="#738886" stroke-width=".7"/><g stroke="#738886" stroke-width=".7">${[0,1,2,3,4,5,6].map(i=>`<path d="M26 ${14+i*14}h8"/>`).join('')}</g><g fill="#a8b8b2" font-family="monospace" font-size="9"><text x="4" y="17">60</text><text x="4" y="59">30</text><text x="10" y="101">0</text><text x="3" y="117">m</text></g><rect x="44" y="14" width="13" height="84" rx="3" fill="#506962" fill-opacity=".25"/><rect id="height-fill" x="44" y="14" width="13" height="84" rx="3" fill="url(#height-color)"/><path id="height-pointer" d="M62 14h9l5 5-5 5h-9" fill="#e9ce98"/><text id="gauge-height" x="85" y="36" fill="#f5e7c7" font-family="monospace" font-size="23">60.0</text><text x="86" y="51" fill="#a8b8b2" font-size="9">距地面 / 米</text><path d="M86 69h73M86 73h73" stroke="#4e6762"/><rect id="fuel-fill" x="86" y="69" width="73" height="4" fill="#b7cdbb"/><text id="engine-state" x="85" y="96" fill="#d6ba8d" font-size="11">发动机待命</text></svg>`;
  else {
    const pt=(x,z)=>[18+x*17,22+z*17];
    hud.innerHTML=`<div class="instrument-title">我的路线 <span>N ↑</span></div><svg class="route-map" viewBox="0 0 175 139" role="img" aria-label="障碍、目标与自己的行驶路线"><defs><pattern id="map-grid" width="17" height="17" patternUnits="userSpaceOnUse" x="9.5" y="13.5"><path d="M17 0H0V17" fill="none" stroke="#668078" stroke-width=".55" opacity=".4"/></pattern></defs><rect x="9.5" y="13.5" width="153" height="119" fill="url(#map-grid)" stroke="#6d8980" stroke-width=".6"/>${GRID.blocks.map(([x,z])=>`<rect x="${pt(x,z)[0]-5}" y="${pt(x,z)[1]-5}" width="10" height="10" rx="2" fill="#c8a984"/>`).join('')}<polyline id="map-trail" fill="none" stroke="#8dcdc1" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>${Object.entries(TARGETS).map(([id,t])=>`<g data-map-target="${id}"><circle cx="${pt(t.x,t.z)[0]}" cy="${pt(t.x,t.z)[1]}" r="6" stroke="#edc88a" fill="none"/><circle cx="${pt(t.x,t.z)[0]}" cy="${pt(t.x,t.z)[1]}" r="2" fill="#edc88a"/></g>`).join('')}<g id="map-rover"><path d="M0-6 4 5 0 3-4 5Z" fill="#eaf4df"/><circle r="9" fill="none" stroke="#c6dbc8" stroke-opacity=".5" stroke-width=".7"/></g></svg>`;
  }
  root.append(hud);let previous="";
  return {
    update(data) {
      if(kind==="lander") {
        const f=Math.min(1,Math.max(0,data.height/60));hud.querySelector("#height-fill").setAttribute("y",98-f*84);hud.querySelector("#height-fill").setAttribute("height",f*84);
        hud.querySelector("#height-pointer").setAttribute("transform",`translate(0,${84*(1-f)-5})`);
        hud.querySelector("#gauge-height").textContent=Math.max(0,data.height).toFixed(1);hud.querySelector("#fuel-fill").setAttribute("width",73*Math.max(0,data.fuel/LANDER.fuelSeconds));
        hud.querySelector("#engine-state").textContent=data.braking&&data.fuel>0&&data.status==="flying"?"正在制动":data.height<=0?"已触地":data.active?"自由下降":"发动机待命";
      } else {
        const key=JSON.stringify([data.x,data.z,data.yaw,data.target,data.path?.length]);if(key===previous)return;previous=key;
        hud.querySelector("#map-rover").setAttribute("transform",`translate(${18+data.x*17},${22+data.z*17}) rotate(${data.yaw*180/Math.PI})`);
        hud.querySelector("#map-trail").setAttribute("points",(data.path||[]).map(p=>`${18+p.x*17},${22+p.z*17}`).join(' '));
        hud.querySelectorAll("[data-map-target]").forEach(n=>{n.style.opacity=n.dataset.mapTarget===data.target?"1":".35";});
      }
    },
  };
}
