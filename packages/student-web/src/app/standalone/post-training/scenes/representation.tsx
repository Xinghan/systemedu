import { ALGORITHMS } from '../algorithm-catalog'
import { NF4, quantize, sum } from '../algorithm-math'
import { C, coord, Label, mix, n, Pick, smooth, Text, type SceneProps } from './primitives'
import { Axis, DragHandle } from './direct-manipulation'

export function QuantizationScene(p:SceneProps){
  const {v,time}=p,w=[-.7,-.3,-.1,0,.2,.4,.6,v.outlier],d=quantize(w,!!v.uniform),book=v.uniform?Array.from({length:16},(_,i)=>-1+i*2/15):NF4,sx=(x:number)=>150+(x+1)*400,phase=smooth(time-1),chosen=v.index
  const bounds=[-1,...book.slice(1).map((x,i)=>(x+book[i])/2),1]
  return <g data-representation="quantization-voronoi-strips">
    <Label x={35} y={38} title="把整块权重放进量化格：每个区间只保留一个代表值" sub="竖向条带是最近邻归属区间；蓝点是原值，金点向码本吸附，粉色线段是舍入距离"/>
    {book.map((value,i)=><Pick key={i} id={`code:${i}`} label={`量化格 ${i}，码本值 ${n(value)}`} p={p}><rect x={coord(sx(bounds[i]))} y="120" width={coord((bounds[i+1]-bounds[i])*400)} height="315" fill={i%2?C.blue:C.purple} fillOpacity={i===d.codes[chosen]?.19:.055} stroke={C.grid}/><path d={`M${coord(sx(value))} 120V435`} stroke={C.frozen} strokeOpacity=".3" strokeDasharray="3 6"/><Text x={sx(value)} y={108} size={11} color={i===d.codes[chosen]?C.gold:C.muted} anchor="middle">{i}</Text></Pick>)}
    {w.map((value,i)=>{const y=143+i*39,original=d.normalized[i],code=book[d.codes[i]],current=mix(original,code,phase);return <Pick key={i} id={`weight:${i}`} label={`选择权重 ${i}，原值 ${n(value)}，恢复 ${n(d.restored[i])}`} p={p}>
      {i===chosen&&<rect x="25" y={y-17} width="985" height="34" fill={C.gold} fillOpacity=".09"/>}
      <Text x={30} y={y+5} color={i===chosen?C.gold:C.muted} size={15}>w{i}={n(value)}</Text>
      <path d={`M${coord(sx(original))} ${y}H${coord(sx(code))}`} stroke={C.pink} strokeWidth={i===chosen?4:2}/>
      <circle cx={coord(sx(original))} cy={y} r="5" fill="none" stroke={C.blue} strokeWidth="2"/>
      <circle cx={coord(sx(current))} cy={y} r={i===chosen?8:5} fill={i===chosen?C.gold:C.blue}/>
      <Text x={990} y={y+5} anchor="end" size={12} color={C.pink}>{n(d.errors[i])}</Text>
    </Pick>})}
    <Text x={150} y={460} size={12} color={C.muted}>u=−1</Text><Text x={550} y={460} anchor="middle" size={12} color={C.muted}>0</Text><Text x={950} y={460} anchor="end" size={12} color={C.muted}>u=+1</Text>
    <Axis x={65} y={505} w={300} min={1} max={6}/>
    <DragHandle x={65+(v.outlier-1)/5*300} y={505} min={1} max={6} step={.25} value={v.outlier} label="拖动块内离群值" param="outlier" p={p} toValue={([x])=>1+(x-65)/300*5}/>
    <Text x={440} y={500} size={21} color={C.gold}>w{chosen} → {d.codes[chosen].toString(2).padStart(4,'0')} → {n(d.restored[chosen])}</Text>
    <Text x={440} y={532} size={14} color={C.muted}>scale={n(d.scale)} · 横轴是归一化值 · 块 MSE={n(d.mse)}</Text>
  </g>
}

function floatBits(value:number){const buffer=new ArrayBuffer(4),view=new DataView(buffer);view.setFloat32(0,value);return view.getUint32(0).toString(2).padStart(32,'0')}
export function DoubleQuantScene(p:SceneProps){
  const {v,time}=p,scales=[.8,1,v.scale,2],offset=sum(scales)/4,s=Math.max(...scales.map(x=>Math.abs(x-offset))),codes=scales.map(x=>Math.round(((x-offset)/s+1)*127.5)),restored=codes.map(x=>(x/127.5-1)*s+offset),packed=time>=1,packing=smooth(time),before=4+32/v.block,after=4+8/v.block+32/(256*v.block)
  return <g data-representation="nested-bit-packing">
    <Label x={35} y={38} title="打开量化文件，看看空间究竟花在哪些 bit 上" sub="左侧表示4bit权重块；右侧逐位展示它的 scale。第二层压缩的是 scale，不是 adapter。"/>
    <Text x={60} y={103} size={13} color={C.muted}>权重载荷（仅示意，不逐位展开）</Text><Text x={330} y={103} size={16} color={packed?C.purple:C.blue}>{packed?'二级量化后的8bit码字':'一级 scale 的 IEEE 754 / FP32 位模式'}</Text>
    {scales.map((scale,i)=>{const y=128+i*67,bits=packed?codes[i].toString(2).padStart(8,'0'):floatBits(scale);return <g key={i}>
      <path d={`M60 ${y}h170l15 15v25H60Z`} fill={C.frozen} fillOpacity=".15" stroke={C.frozen}/><Text x={75} y={y+26} size={14} color={C.frozen}>block {i}: {v.block} × 4 bit</Text>
      <Pick id={`scale-one:${i}`} label={`检查 scale ${i} 的存储与恢复`} p={p}>{Array.from(bits).map((bit,j)=><g key={j}><rect x={coord(330+j*(packed?17:mix(17,4.25,packing)))} y={y} width={packed?15:mix(15,3.25,packing)} height="30" fill={bit==='1'?(packed?C.purple:C.blue):C.grid} fillOpacity={bit==='1'?.75:.25}/><Text opacity={packed?1:1-packing} x={337.5+j*17} y={y+21} size={11} anchor="middle" color={bit==='1'?'var(--scene-bg,#0b1320)':C.muted}>{bit}</Text></g>)}<Text x={330} y={y+49} size={12} color={i===2?C.gold:C.muted}>{packed?`q₂=${codes[i]} → 恢复 scale ${n(restored[i])}`:`scale=${n(scale)} · 32 bit`}</Text></Pick>
      {packed&&<Text x={550} y={y+23} color={C.gold} size={15}>省下 24 bit / block</Text>}
    </g>})}
    <path d="M335 405h530" stroke={C.purple}/><Text x={335} y={433} size={16} color={C.purple}>共享的二级尺度 {n(s)} + offset {n(offset)}</Text>
    <Text x={60} y={475} color={C.muted} size={13}>每个权重的成本（忽略偏置、对齐等元数据）</Text>
    <rect x="60" y="492" width="480" height="25" fill={C.frozen} fillOpacity=".3"/><rect x="540" y="492" width={coord(120*mix(before-4,after-4,packing))} height="25" fill={C.gold}/>
    <Text x={75} y={510} size={12}>4 bit 的权重主体一直保留</Text><Text x={700} y={512} color={C.gold} size={24}>{n(packed?after:before)} bit/weight</Text>
    <Text x={60} y={545} size={12} color={C.muted}>二级8bit码本采用中心化均匀教学近似；保留实际量化误差</Text>
  </g>
}

export function CheckpointScene(p:SceneProps){
  const {v,time}=p,frames=ALGORITHMS.checkpoint.frames(v),other=ALGORITHMS.checkpoint.frames({enabled:v.enabled?0:1}),index=Math.min(7,Math.floor(time)),cell=96,left=170,top=135,counts=frames.map(f=>sum(f.values)),otherCounts=other.map(f=>sum(f.values)),front=v.enabled?(index<4?index+1:index<6?5:6):Math.min(4,index+1)
  return <g data-representation="activation-lifetime-gantt">
    <Label x={35} y={38} title="沿时间切开训练：激活什么时候占内存，什么时候可以释放？" sub="点击一列定位执行事件。金色格是重算恢复；空白格没有驻留，灰色虚线给出另一策略的占用。"/>
    {frames.map((frame,i)=><Pick key={i} id={`execution:${i}`} label={`执行事件 ${i+1}：${frame.title}`} p={p}><rect x={left+i*cell} y="90" width={cell-3} height="280" fill={i===index?C.gold:'transparent'} fillOpacity={i===index?.08:1}/><Text x={left+i*cell+cell/2} y={105} size={11} anchor="middle" color={i===index?C.gold:C.muted}>{frame.title}</Text></Pick>)}
    {[0,1,2,3,4].map(row=><g key={row}><Pick id={`activation:${row}`} label={`查看 h${row} 的生命周期`} p={p}><Text x={120} y={top+row*43+22} anchor="end" size={20} color={C.blue}>h{row}</Text></Pick>{frames.map((f,col)=>{const stored=!!f.values[row],recreated=!!v.enabled&&((col===4&&row===3)||(col===6&&row===1));return <Pick key={col} id={`execution:${col}`} label={`事件 ${col+1}，h${row}${stored?'驻留':'未保存'}`} p={p}><rect x={left+col*cell} y={top+row*43} width={cell-4} height="33" rx="3" fill={stored?(recreated?C.gold:C.teal):C.grid} fillOpacity={stored?(col<=index?.8:.25):.15}/>{recreated&&<Text x={left+col*cell+cell/2} y={top+row*43+22} anchor="middle" size={12} color="var(--scene-bg,#0b1320)">重算</Text>}</Pick>})}</g>)}
    <Text x={120} y={409} size={13} anchor="end" color={C.muted}>驻留份数</Text>
    <polyline points={counts.map((count,i)=>`${left+i*cell+cell/2},${485-count*23}`).join(' ')} fill="none" stroke={C.teal} strokeWidth="3"/>
    <polyline points={otherCounts.map((count,i)=>`${left+i*cell+cell/2},${485-count*23}`).join(' ')} fill="none" stroke={C.frozen} strokeWidth="2" strokeDasharray="5 5"/>
    <path d={`M${coord(left+(time+.5)*cell)} 118V490`} stroke={C.gold} strokeWidth="2"/>
    <circle cx={left+(index+.5)*cell} cy={485-counts[index]*23} r="7" fill={C.teal}/>
    <Text x={60} y={532} size={20} color={C.teal}>当前 {counts[index]} 份激活</Text><Text x={410} y={532} size={20} color={C.gold}>已执行前向 {front} 次</Text><Text x={730} y={532} size={13} color={C.muted}>时间列等宽，不代表实际耗时</Text>
  </g>
}
