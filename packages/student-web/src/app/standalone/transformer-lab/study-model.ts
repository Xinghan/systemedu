import { dot, softmax } from './math'
export const geluValue = (x:number) => .5*x*(1+Math.tanh(Math.sqrt(2/Math.PI)*(x+.044715*x**3)))
export function normalize(values:number[],gamma=1,beta=0,epsilon=1e-5) {
 const mean=values.reduce((a,b)=>a+b,0)/values.length
 const variance=values.reduce((a,b)=>a+(b-mean)**2,0)/values.length
 const centered=values.map(x=>x-mean),standardized=centered.map(x=>x/Math.sqrt(variance+epsilon))
 return {mean,variance,centered,standardized,output:standardized.map(x=>x*gamma+beta)}
}
export function tinyAttention(q:number[],query:number,masked=true) {
 const K=[[1,0],[0,1],[-1,0]],V=[[2,0],[0,4],[8,8]]
 const products=K.map(k=>q.map((v,i)=>v*k[i]))
 const scores=K.map(k=>dot(q,k)),scaled=scores.map(x=>x/Math.sqrt(q.length))
 const visible=scaled.map((x,j)=>!masked||j<=query?x:-Infinity)
 const weights=softmax(visible),output=[0,1].map(r=>weights.reduce((sum,a,j)=>sum+a*V[j][r],0))
 return {K,V,products,scores,scaled,visible,weights,output}
}
export const E=[[1,0],[0,2],[-1,1]],P=[[0,0],[.2,-.1],[-.1,.3]]
export function tinyEmbedding(token:number,position:number,withPosition=true){return E[token].map((v,r)=>v+(withPosition?P[position][r]:0))}
export const projectionW=[[1,0],[0,1],[-1,1],[0,.5],[.5,-1],[0,1]]
export function project(z:number[],column:number){const products=z.map((v,r)=>v*projectionW[r][column]);return {products,output:products.reduce((a,b)=>a+b,0)}}
export function tinyMLP(x:number[],nonlinear=true){const hidden=[x[0],x[1],-x[0]+x[1]],activated=hidden.map(v=>nonlinear?geluValue(v):v);return {hidden,activated,output:[activated[0]+activated[2],activated[1]-activated[2]]}}
export const matrixA=[[1,2],[3,4]],matrixB=[[2,0],[-1,1]]
export const matrixCell=(row:number,column:number)=>dot(matrixA[row],matrixB.map(r=>r[column]))
