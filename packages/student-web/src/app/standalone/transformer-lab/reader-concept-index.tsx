'use client'
import { useState } from 'react'
import { lessons } from './reader-lessons'
import c from './reader.module.css'

const groups = [...new Set(lessons.map(lesson => lesson.group))]
const entries = lessons.flatMap((lesson, index) => lesson.sections.flatMap(section =>
  section.concept ? [{
    group: lesson.group, lesson: index + 1, name: section.concept.name, title: section.title,
    href: '#lesson/' + lesson.id + '/' + section.concept.id,
    keywords: [section.concept.name, section.concept.id, section.title].join(' ').toLowerCase(),
  }] : [],
))

export function ReaderConceptIndex() {
  const [query, setQuery] = useState('')
  const words = query.trim().toLowerCase().split(/\s+/)
  const matches = entries.filter(entry => words.every(word => entry.keywords.includes(word)))
  return <section className={c.conceptIndex} aria-labelledby="concepts">
    <h2 id="concepts" tabIndex={-1}>按概念找课文</h2>
    <label>输入想弄明白的词<input type="search" value={query} placeholder="例如 softmax、点积、梯度" onChange={event=>setQuery(event.target.value)}/></label>
    {query.trim() && <p role="status">{matches.length ? '找到 '+matches.length+' 段相关课文。' : '这个词没有单列。可以换一个词，或清空后按主题查看。'}</p>}
    {groups.map(group=>{
      const rows = matches.filter(entry=>entry.group===group)
      if (!rows.length) return null
      const links = <ul>{rows.map(entry=><li key={entry.href}><a href={entry.href}>{entry.name}</a><small>第 {entry.lesson} 节</small></li>)}</ul>
      return query.trim() ? <div key={group}><h3>{group}</h3>{links}</div> : <details key={group}><summary>{group}（{rows.length}）</summary>{links}</details>
    })}
  </section>
}
