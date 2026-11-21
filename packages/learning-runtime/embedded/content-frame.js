/* Runs only inside sandboxed course frames. No native bridge or account token. */
(() => {
  let storage = {}, references = {}, channel = ''
  try { const state = JSON.parse(decodeURIComponent(location.hash.slice(1))); storage = state.storage || {}; references = state.references || {}; channel = state.channel || '' } catch {}
  const publish = () => { const text=JSON.stringify(storage); parent.postMessage({type:'course-frame-state',channel,storage,oversized:new TextEncoder().encode(text).length>90000},'*') }
  const shim = {
    getItem(key) { return Object.prototype.hasOwnProperty.call(storage,String(key)) ? storage[String(key)] : references[String(key)] ?? null },
    setItem(key,value) { const next={...storage,[String(key)]:String(value)}; if(new TextEncoder().encode(JSON.stringify(next)).length>90000) { parent.postMessage({type:'course-frame-state',channel,oversized:true},'*'); throw new DOMException('实验记录超过本机课堂单项容量，请先导出作品。','QuotaExceededError') } storage=next;publish() },
    removeItem(key) { delete storage[String(key)];publish() }, clear() {storage={};publish()}, key(i) { return Object.keys({...references,...storage})[i] ?? null }, get length() {return Object.keys({...references,...storage}).length}
  }
  Object.defineProperty(window,'localStorage',{value:shim});Object.defineProperty(window,'sessionStorage',{value:shim})
  // Some original engines use UUID in non-HTTPS sandbox origins.
  if (!crypto.randomUUID) crypto.randomUUID=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('')
  document.addEventListener('click',async event=>{
    const a=event.target.closest?.('a');if(!a)return
    if(a.href.startsWith('blob:') || a.href.startsWith('data:')) {
      event.preventDefault();const blob=await fetch(a.href).then(r=>r.blob())
      if(blob.size>12_000_000){ parent.postMessage({type:'course-frame-error',channel,message:'文件超过 12 MB，请减小作品后导出。'},'*');return }
      const reader=new FileReader();reader.onload=()=>parent.postMessage({type:'course-frame-download',channel,name:a.download||'experiment.json',data:reader.result},'*');reader.readAsDataURL(blob)
    } else if(/^https?:/.test(a.href)) {event.preventDefault();parent.postMessage({type:'course-frame-link',channel,url:a.href},'*')}
  },true)
  // Legacy HTML labs often keep their controls only in closure variables.
  // Restore user-editable inputs through their original event handlers.
  const search = location.search.replace(/([?&])presentation=[^&]*(&?)/, (_, lead, tail) => tail ? lead : '')
  const formKey='ios:controls:'+location.pathname+search
  const fields=()=>Array.from(document.querySelectorAll('input,select,textarea')).filter(el=>!['file','password','hidden','button','submit'].includes(el.type))
  const formSnapshot=()=>{
    if(document.getElementById('root')) return
    const value=fields().map((el,index)=>({id:el.id||el.name||String(index),value:el.value,checked:el.checked}))
    if(value.length) try {shim.setItem(formKey,JSON.stringify(value))} catch {}
  }
  document.addEventListener('DOMContentLoaded',()=>{
    if(document.getElementById('root')) return
    let saved=[];try {saved=JSON.parse(shim.getItem(formKey)||'[]')} catch {}
    fields().forEach((el,index)=>{
      const value=saved.find(v=>v.id===(el.id||el.name||String(index)));if(!value)return
      el.value=value.value;if(typeof value.checked==='boolean')el.checked=value.checked
      el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))
    })
    document.addEventListener('input',formSnapshot);document.addEventListener('change',formSnapshot)
  })
  addEventListener('pagehide',publish)
})()
