import http from 'node:http'
// 同源验收隔离前端和现有后端；隧道只监听本地回环地址。
http.createServer((req,res)=>{
  const upstream=http.request({hostname:'127.0.0.1',port:req.url.startsWith('/api/')?14002:14001,path:req.url,method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)})
  upstream.on('error',()=>{res.writeHead(502);res.end('Preview tunnel unavailable')});req.pipe(upstream)
}).listen(14003,'127.0.0.1',()=>console.log('Energy candidate proxy http://127.0.0.1:14003'))
