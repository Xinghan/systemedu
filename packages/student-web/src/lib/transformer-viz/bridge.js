// Learning adapter for Brendan Bycroft's MIT-licensed llm-viz engine.
import { CanvasRender } from './vendor/llm/CanvasRender';
import { fetchFontAtlasData } from './vendor/llm/render/fontRender';
import { loadNativeBindings, TensorType } from './vendor/llm/NativeBindings';
import { TensorF32 } from './vendor/utils/tensor';
import { Vec3 } from './vendor/utils/vector';
import { Phase } from './vendor/llm/walkthrough/Walkthrough';
import { getBlockValueAtIdx } from './vendor/llm/components/DataFlow';
import { runMouseHitTesting } from './vendor/llm/Interaction';

const base = '/standalone/transformer-lab/model/';
const phases = {embedding:Phase.Input_Detail_Embedding,norm:Phase.Input_Detail_LayerNorm,attention:Phase.Input_Detail_SelfAttention,softmax:Phase.Input_Detail_Softmax,projection:Phase.Input_Detail_Projection,mlp:Phase.Input_Detail_Mlp,residual:Phase.Input_Detail_Transformer,output:Phase.Input_Detail_Output};
export function conceptFor(name) {
  if (/embed|tokens/i.test(name)) return 'embedding';
  if (/norm|LN |γ|β/i.test(name)) return 'norm';
  if (/Logits|LM Head|SM Agg/.test(name)) return 'output';
  if (/Residual/.test(name)) return 'residual';
  if (/MLP/.test(name)) return 'mlp';
  if (/Softmax/.test(name)) return 'softmax';
  if (/Projection|Attention Output|Combined/.test(name)) return 'projection';
  return 'attention';
}
async function tensorData(name) {
  const response = await fetch(base + name);
  if (!response.ok) throw new Error('模型资源加载失败：' + name);
  const json = await response.json();
  for (const key in json) if (json[key].shape) json[key] = TensorF32.fromJson(json[key]);
  return json;
}
export async function createExplorer(canvas, onFrame, onPick, signal) {
  const [font, data, model, native] = await Promise.all([fetchFontAtlasData(),tensorData('gpt-nano-sort-t0-partials.json'),tensorData('gpt-nano-sort-model.json'),loadNativeBindings()]);
  if(signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  const engine = new CanvasRender(canvas, {}, font), state = engine.progState;
  if (!state.render) { engine.destroy(); throw new Error('此 3D 模型需要 WebGL 2。请使用支持 WebGL 2 的浏览器。'); }
  state.inWalkthrough = false;
  state.examples.forEach(example => example.enabled = false);
  state.camera.center = new Vec3(42.771,0,-569.287);
  state.camera.angle = new Vec3(285,26,13.5);
  state.mouse.mousePos = new Vec3(-10000,-10000,0);
  engine.setData({dataAndModel:{data,model,native}});
  let selection = null, concept = null, drag = null, lastFrame = 0, force = true;
  const tensor = (type, layer=0) => native.getModelTensor(state.wasmGptModel.modelPtr,type,layer);
  function snapshot() {
    const wt=state.walkthrough, len=state.jsGptModel.inputLen;
    const tokens=Array.from(tensor(TensorType.InputTokens).buffer.slice(0,len));
    const probabilities=Array.from(tensor(TensorType.LogitsSm).buffer.slice((len-1)*3,len*3));
    return {time:wt.time,duration:wt.phaseLength,running:wt.running,concept,tokens,probabilities,selection};
  }
  const originalRender=engine.render.bind(engine);
  engine.render=(time,dt)=>{
    const before=[state.camera.center.x,state.camera.center.y,state.camera.center.z,state.camera.angle.x,state.camera.angle.y,state.camera.angle.z];
    originalRender(time,dt);
    const after=[state.camera.center.x,state.camera.center.y,state.camera.center.z,state.camera.angle.x,state.camera.angle.y,state.camera.angle.z];
    if(before.some((v,i)=>v!==after[i])) engine.markDirty();
    if(force || time-lastFrame>100) {lastFrame=time;force=false;onFrame(snapshot());}
  };
  function changed() {force=true;engine.markDirty();}
  const resize=new ResizeObserver(()=>{engine.canvasSizeDirty=true;changed();});resize.observe(canvas);
  function pointerDown(event) {
    canvas.setPointerCapture(event.pointerId);
    drag={x:event.clientX,y:event.clientY,angle:state.camera.angle.clone(),center:state.camera.center.clone(),rotate:event.shiftKey||event.button===2,moved:false};
  }
  function pointerMove(event) {
    const rect=canvas.getBoundingClientRect();
    state.mouse.mousePos=new Vec3(event.clientX-rect.left,event.clientY-rect.top,0);
    if(drag) {
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      if(Math.hypot(dx,dy)>4) drag.moved=true;
      if(drag.moved){
        state.walkthrough.running=false;
        if(drag.rotate) state.camera.angle=new Vec3(drag.angle.x-dx*.5,Math.max(-87,Math.min(87,drag.angle.y+dy*.5)),drag.angle.z);
        else {const side=Math.sin(drag.angle.x*Math.PI/180)>0?1:-1;state.camera.center=new Vec3(drag.center.x+side*dx*.1*drag.angle.z,drag.center.y,drag.center.z+dy*.1*drag.angle.z);}
      }
    }
    changed();
  }
  function pointerUp(event) {
    if(event.type==='pointercancel'){drag=null;return;}
    const rect=canvas.getBoundingClientRect();
    state.mouse.mousePos=new Vec3(event.clientX-rect.left,event.clientY-rect.top,0);
    runMouseHitTesting(state);
    if(drag && !drag.moved) {
      const target=state.display.hoverTarget;
      if(target){
        const b=target.mainCube,i=target.mainIdx;
        selection={name:b.name||'归约中间量',shape:[b.cx,b.cy,b.cz],index:[i.x,i.y,i.z],value:getBlockValueAtIdx(b,i),concept:!b.name&&[5,6].includes(b.deps?.special)?'norm':!b.name&&[7,8].includes(b.deps?.special)?'softmax':conceptFor(b.name)};
        concept=selection.concept;state.walkthrough.running=false;onPick(selection);changed();
      }
    }
    drag=null;
  }
  function wheel(event){event.preventDefault();state.camera.angle.z=Math.max(.1,Math.min(200,state.camera.angle.z*Math.pow(1.0013,event.deltaY)));changed();}
  const menu=event=>event.preventDefault();
  canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);canvas.addEventListener('wheel',wheel,{passive:false});canvas.addEventListener('contextmenu',menu);
  changed();
  return {
    destroy(){resize.disconnect();engine.destroy();canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',pointerUp);canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('contextmenu',menu);},
    focus(id){concept=id;selection=null;state.inWalkthrough=true;state.walkthrough.phase=phases[id];state.walkthrough.time=0;state.walkthrough.running=false;state.walkthrough.prevPhase=Phase.None;engine.render(performance.now(),16);const start=state.walkthrough.cameraInitial;if(start){state.camera.center=start.center.clone();state.camera.angle=start.angle.clone();if(state.walkthrough.phaseTransitiveData)state.walkthrough.phaseTransitiveData.cameraT=1;}changed();},
    overview(){concept=null;state.inWalkthrough=false;state.walkthrough.running=false;state.camera.center=new Vec3(42.771,0,-569.287);state.camera.angle=new Vec3(285,26,13.5);changed();},
    play(){if(!concept) return;if(state.walkthrough.phase!==phases[concept]){state.walkthrough.phase=phases[concept];state.walkthrough.time=0;state.walkthrough.prevPhase=Phase.None;}state.inWalkthrough=true;if(state.walkthrough.time>=state.walkthrough.phaseLength)state.walkthrough.time=0;state.walkthrough.running=!state.walkthrough.running;changed();},
    scrub(value){state.walkthrough.running=false;state.walkthrough.time=Math.max(0,Math.min(value,state.walkthrough.phaseLength));changed();},
    speed(value){state.walkthrough.speed=value;changed();},
    rotate(){state.camera.angle.x+=30;changed();},
    zoom(factor){state.camera.angle.z=Math.max(.1,Math.min(200,state.camera.angle.z*factor));changed();},
    input(text){
      if(!/^[ABC]{1,6}$/.test(text))throw new Error('请输入 1–6 个 A、B 或 C。模型训练任务是对 6 个字符排序。');
      const input=tensor(TensorType.InputTokens);input.buffer.fill(0);input.buffer.set([...text].map(c=>'ABC'.indexOf(c)));state.jsGptModel.inputLen=text.length;native.runModel(state.wasmGptModel.modelPtr);state.wasmGptModel.intersDirty=true;changed();
    },
    step(){if(state.jsGptModel.inputLen<11){state.stepModel=true;changed();}},
    attentionInput(layer=0,head=0){
      const length=state.jsGptModel.inputLen,buf=tensor(TensorType.AttnQkv,layer).buffer;
      const matrix=offset=>Array.from({length},(_,t)=>Array.from(buf.slice(t*144+head*16+offset,t*144+head*16+offset+16)));
      return {id:'model',title:`当前模型 · Block ${layer+1} · Head ${head+1}`,Q:matrix(0),K:matrix(48),V:matrix(96)};
    },
    attentionWeights(layer=0,head=0){const len=state.jsGptModel.inputLen,buf=tensor(TensorType.AttnSm,layer).buffer;return Array.from({length:len},(_,t)=>Array.from(buf.slice(head*121+t*11,head*121+t*11+len)));},
  };
}
