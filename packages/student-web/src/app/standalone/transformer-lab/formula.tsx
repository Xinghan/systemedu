'use client'
import { useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import s from './study.module.css'

export function Formula({source,inline=false}:{source:string;inline?:boolean}){
 const html=useMemo(()=>katex.renderToString(source,{displayMode:!inline,throwOnError:false,trust:false,output:'htmlAndMathml',strict:'ignore'}),[source,inline])
 return <span className={inline?s.inlineMath:s.formula} dangerouslySetInnerHTML={{__html:html}}/>
}
