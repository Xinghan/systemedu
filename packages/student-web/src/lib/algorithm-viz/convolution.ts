import { type AlgorithmGraph, type Matrix, validateGraph } from './graph'

export function convolutionGraph(center=5):AlgorithmGraph {
  const image:Matrix=[[1,2,0,1],[0,center,3,2],[2,1,4,0],[1,0,2,3]], kernel:Matrix=[[1,0],[-1,1]]
  const output=Array.from({length:3},(_,r)=>Array.from({length:3},(_,c)=>kernel.reduce((sum,row,i)=>sum+row.reduce((s,w,j)=>s+w*image[r+i][c+j],0),0)))
  const graph:AlgorithmGraph={id:'convolution',title:'2D convolution / cross-correlation',description:'4 × 4 input · 2 × 2 kernel · stride 1',sequence:['conv'],nodes:[
    {id:'image',label:'Input image',data:image,op:'input',inputs:[],category:'convolution',cellAspect:1,color:'#7196b4',position:[-6,1,0]},
    {id:'kernel',label:'Kernel · 2 × 2',data:kernel,op:'input',inputs:[],category:'convolution',cellAspect:1,color:'#ba8b4d',position:[0,2,1]},
    {id:'conv',label:'Output · valid',data:output,op:'correlation',inputs:['image','kernel'],category:'convolution',cellAspect:1,color:'#4b9580',position:[6,1,0]}
  ]}
  validateGraph(graph);return graph
}
