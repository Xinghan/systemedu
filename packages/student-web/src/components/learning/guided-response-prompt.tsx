"use client"

import type { LearningBody } from "@/lib/api/learning-records"
import type { ResponsePrompt } from "@/lib/project-lines/guided-course"
import { responseState, responseText, updateResponse } from "@/lib/project-lines/guided-response"
import styles from "./guided-project-course.module.css"

export function GuidedResponsePrompt({ body, index, prompt, question, locked, onChange }: {
  body: LearningBody; index: number; prompt?: ResponsePrompt; question: string; locked: boolean; onChange: (body: LearningBody) => void
}) {
  const state = responseState(body, index, prompt)
  const answer = body.answers[index]?.answer ?? ""
  const id = `response-${index}`
  function changeField(field: string, value: string) {
    const values = { ...state.values, [field]: value }
    onChange(updateResponse(body, index, { ...state, mode: "guided", values }, responseText(prompt!, values)))
  }
  return <div className={`${styles.responsePrompt} ${prompt?.layout === "comparison" ? styles.comparisonPrompt : ""}`}>
    {prompt && <><p className={styles.promptHint}>{prompt.hint}</p><aside className={styles.responseExample} aria-label="表达示例"><span>看看怎样表达</span><p>{prompt.example}</p><small>示例不会填入你的记录。请写自己的判断和实际观察。</small></aside></>}
    {state.mode === "guided" && prompt ? <>
      <div className={styles.responseFields}>
        {prompt.fields.map(field => field.type === "choice" ? <fieldset key={field.id} disabled={locked} className={styles.choiceField}>
          <legend>{field.label}</legend>
          <div className={styles.choiceOptions}>{field.options?.map(option => <label key={option} className={styles.choiceOption}>
            <input type="radio" name={`${id}-${field.id}`} checked={state.values[field.id] === option} value={option} onChange={() => changeField(field.id, option)} />
            <span>{option}</span>
          </label>)}</div>
        </fieldset> : <label key={field.id} className={styles.shortField}>
          <span>{field.label}</span>
          {field.type === "text" ? <textarea rows={2} maxLength={600} value={state.values[field.id] ?? ""} disabled={locked} placeholder={field.placeholder} onChange={event => changeField(field.id, event.target.value)} /> : <input type="text" maxLength={300} value={state.values[field.id] ?? ""} disabled={locked} placeholder={field.placeholder} onChange={event => changeField(field.id, event.target.value)} />}
        </label>)}
      </div>
      {answer && <div className={styles.answerPreview} aria-label="我的记录预览"><span>你的记录</span><p>{answer}</p></div>}
      <button className={styles.quietButton} type="button" disabled={locked} onClick={() => onChange(updateResponse(body, index, { version: 1, mode: "free", values: {} }, answer))}>我想自己组织表达</button>
    </> : <div className={styles.freeResponse}>
      <label><span>{prompt ? "用自己的话说，一两句也可以" : question}</span><textarea rows={2} aria-label={question} data-free-answer maxLength={5000} value={answer} disabled={locked} placeholder="说清你观察到了什么，以及你自己的理由。" onChange={event => onChange(updateResponse(body, index, { version: 1, mode: "free", values: {} }, event.target.value))} /></label>
      {prompt && !answer && <button type="button" className={styles.quietButton} disabled={locked} onClick={() => onChange(updateResponse(body, index, { version: 1, mode: "guided", values: {} }, ""))}>使用分步填写</button>}
      {answer && <p className={styles.promptHint}>你的原话会完整保留，也可以继续修改。</p>}
    </div>}
  </div>
}
