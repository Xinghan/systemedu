/* Runs only inside sandboxed course frames. No native bridge or account token. */
(() => {
  if(new URLSearchParams(location.search).get('presentation')==='tablet' && location.pathname.endsWith('/spot-a-world/index.html')) {
    document.documentElement.dataset.presentation='tablet'
    const style=document.createElement('link');style.rel='stylesheet';style.href='/ipad-observatory.css';document.head.append(style)
  }
  let storage = {}, references = {}, channel = '', photoRevision = 0, savedPhotoRevision = 0
  try { const state = JSON.parse(decodeURIComponent(location.hash.slice(1))); storage = state.storage || {}; references = state.references || {}; channel = state.channel || '' } catch {}
  const publish = () => { const text=JSON.stringify(storage); parent.postMessage({type:'course-frame-state',channel,storage,photoRevision,oversized:new TextEncoder().encode(text).length>90000},'*') }
  const shim = {
    getItem(key) { return Object.prototype.hasOwnProperty.call(storage,String(key)) ? storage[String(key)] : references[String(key)] ?? null },
    setItem(key,value) { const next={...storage,[String(key)]:String(value)}; if(new TextEncoder().encode(JSON.stringify(next)).length>90000) { parent.postMessage({type:'course-frame-state',channel,oversized:true},'*'); throw new DOMException('实验记录超过本机课堂单项容量，请先导出作品。','QuotaExceededError') } if(String(key)==='systemedu:spot-a-world:v1' && storage[String(key)]!==String(value))photoRevision++;storage=next;publish() },
    removeItem(key) { delete storage[String(key)];publish() }, clear() {storage={};publish()}, key(i) { return Object.keys({...references,...storage})[i] ?? null }, get length() {return Object.keys({...references,...storage}).length}
  }
  Object.defineProperty(window,'localStorage',{value:shim});Object.defineProperty(window,'sessionStorage',{value:shim})
  // A display-only identity arrives from this frame's owner; it is never stored or put in a URL.
  addEventListener('message', event => {
    const data=event.data, crew=data?.crew
    if(event.source!==parent || data?.channel!==channel || !channel) return
    if(data?.type==='course-frame-saved' && location.pathname.endsWith('/spot-a-world/index.html')) {
      if(typeof data.photoRevision==='number' && data.photoRevision<=photoRevision)savedPhotoRevision=Math.max(savedPhotoRevision,data.photoRevision)
      const status=document.getElementById('save-status');if(status && savedPhotoRevision===photoRevision)status.textContent='照片与观测记录已保存到本机。返回课堂后，把它收进本章作品。'
      return
    }
    if(data?.type!=='course-frame-crew' || !crew) return
    if(typeof crew.name!=='string' || crew.name.length>20 || typeof crew.avatar!=='string') return
    const portrait=crew.avatar
    if(!(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(portrait) && portrait.length<150000) && !/^\/mission\/space\/expedition-v2\/crew\/(observer|engineer|navigator)\.png$/.test(portrait)) return
    if(!location.pathname.endsWith('/spot-a-world/index.html')) return
    const heading=document.querySelector('.mission-heading')
    if(heading && !heading.querySelector('[data-crew-portrait]')) {
      const icon=heading.querySelector('.line-mark'), label=heading.querySelector('span:nth-child(2)')
      const image=document.createElement('img');image.src=portrait;image.alt=crew.name+'的卡通形象';image.dataset.crewPortrait='true'
      image.style.cssText='width:38px;height:44px;object-fit:cover;object-position:top;border-radius:10px;flex-shrink:0'
      icon?.replaceWith(image);if(label)label.textContent=crew.name+'的观测席'
    }
    const signature=document.querySelector('.photo-caption span:last-child')
    if(signature) signature.textContent=crew.name+' · 亲手取景'
    const title=document.querySelector('.photo-detail .eyebrow')
    if(title) title.textContent=crew.name+'的第一份远征作品'
  })
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
    parent.postMessage({type:'course-frame-ready',channel},'*')
    if(location.pathname.endsWith('/spot-a-world/index.html')) {
      const note=document.getElementById('storage-note');if(note)note.textContent='照片会随远航记录保存在本机，也可以下载带走。'
      const status=document.getElementById('save-status')
      if(status)new MutationObserver(()=>{if(status.textContent.startsWith('作品已保存到这个浏览器'))status.textContent=photoRevision>savedPhotoRevision ? '正在把照片收进本机记录…' : '照片与观测记录已保存到本机。返回课堂后，把它收进本章作品。'}).observe(status,{childList:true,characterData:true,subtree:true})
    }
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
