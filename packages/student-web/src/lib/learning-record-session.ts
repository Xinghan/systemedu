import { ApiError } from "./api/client"
import { learningRecords, type LearningBody, type LearningScope, type LearningSubmission } from "./api/learning-records"

export type RecordState = {
  body: LearningBody; ready: boolean; busy: boolean; dirty: boolean; conflict: boolean; attention: boolean
  message: string; submittedAt?: string; history: LearningSubmission[]; pending: boolean
}
type Pending = { id: string; body: LearningBody; revision: number }
type Cache = { version: 1; body: LearningBody; revision: number; dirty: boolean; submittedAt?: string; pending?: Pending }
// 浏览器拒绝持久存储时，课程内切换节点仍保留本页会话草稿；刷新前需下载。
const memoryCache = new Map<string, { data: Cache; writable: boolean }>()

export function learningCacheKey(owner: string, scope: LearningScope) {
  return `systemedu:learning:v1:${encodeURIComponent(owner)}:${encodeURIComponent(JSON.stringify(scope))}`
}
function validBody(value: unknown): value is LearningBody {
  const b = value as LearningBody | null
  return !!b && Array.isArray(b.answers) && b.answers.length <= 200 && b.answers.every(a => a && typeof a.question_id === "string" && typeof a.question === "string" && typeof a.answer === "string" && a.answer.length <= 20000)
}
function equal(a: LearningBody, b: LearningBody) {
  return JSON.stringify({ answers: a.answers, artifact: a.artifact ?? null, client_context: a.client_context ?? {} }) === JSON.stringify({ answers: b.answers, artifact: b.artifact ?? null, client_context: b.client_context ?? {} })
}

/** 一个账号、一项活动的保存会话；请求串行，缓存只属于该身份。 */
export class LearningRecordSession {
  private state: RecordState
  private initial: RecordState
  private listeners = new Set<() => void>()
  private revision = 0
  private pending?: Pending
  private writable = true
  private started = false
  private timer?: ReturnType<typeof setTimeout>
  private queue = Promise.resolve()
  readonly cacheKey: string
  constructor(readonly token: string | null, owner: string, readonly scope: LearningScope, initial: LearningBody) {
    this.cacheKey = learningCacheKey(owner, scope)
    this.initial = this.state = { body: initial, ready: false, busy: false, dirty: false, conflict: false, attention: false, message: "正在读取学习记录…", history: [], pending: false }
  }
  snapshot = () => this.state
  serverSnapshot = () => this.initial
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private patch(values: Partial<RecordState>) { this.state = { ...this.state, ...values }; this.listeners.forEach(listener => listener()) }
  private cache() {
    const data: Cache = { version: 1, body: this.state.body, revision: this.revision, dirty: this.state.dirty, submittedAt: this.state.submittedAt, pending: this.pending }
    try {
      if (this.writable) localStorage.setItem(this.cacheKey, JSON.stringify(data))
    } catch {
      this.writable = false
      this.patch({ attention: true, message: "本机草稿无法写入；请保持页面打开并下载备份，服务器保存结果会单独显示。" })
    }
    memoryCache.set(this.cacheKey, { data, writable: this.writable })
    if (memoryCache.size > 100) memoryCache.delete(memoryCache.keys().next().value!)
  }
  async start() {
    if (this.started) return
    this.started = true
    try {
      const memory = memoryCache.get(this.cacheKey)
      const raw = memory ? null : localStorage.getItem(this.cacheKey)
      if (memory || raw) {
        const c = memory?.data ?? JSON.parse(raw!) as Cache
        if (memory) this.writable = memory.writable
        if (c.version !== 1 || !validBody(c.body) || !Number.isInteger(c.revision) || c.revision < 0 || typeof c.dirty !== "boolean" || (c.pending && (!validBody(c.pending.body) || typeof c.pending.id !== "string" || !Number.isInteger(c.pending.revision)))) throw new Error("invalid cache")
        this.revision = c.revision; this.pending = c.pending
        this.patch({ body: c.body, dirty: c.dirty, submittedAt: c.submittedAt, pending: !!c.pending })
      }
    } catch {
      this.writable = false
      this.patch({ attention: true, message: "本机旧记录无法读取，原数据未覆盖。" })
    }
    if (!this.token) {
      this.patch({ ready: true, attention: !this.writable, message: this.writable ? "未登录：记录仅保存在当前浏览器，登录后可导入账号。" : "本机存储不可用，原数据未覆盖；请下载当前记录。" })
      return
    }
    await this.refresh(false)
  }
  async refresh(discardLocal = false) {
    if (!this.token) return
    clearTimeout(this.timer)
    await this.queue
    this.patch({ busy: true })
    try {
      const remote = await learningRecords.read(this.token, this.scope)
      const acknowledged = this.pending && remote.submissions.find(s => s.request_id === this.pending!.id)
      if (acknowledged) { this.pending = undefined; this.patch({ pending: false, dirty: false }) }
      if (!discardLocal && this.state.dirty && (remote.draft?.revision ?? 0) !== this.revision) {
        this.patch({ ready: true, conflict: true, attention: true, history: remote.submissions, message: "另一页面或设备已有新版本。当前草稿已保留，请先下载，再读取服务器版本。" })
        return
      }
      if (discardLocal || !this.state.dirty) {
        this.revision = remote.draft?.revision ?? 0
        this.pending = undefined
        this.patch({ body: remote.draft?.body ?? this.initial.body, dirty: false, pending: false,
          submittedAt: remote.draft?.status === "submitted" ? remote.submissions[0]?.created_at : undefined })
      }
      this.patch({ ready: true, conflict: false, attention: false, history: remote.submissions,
        message: this.state.dirty ? "本机有未同步草稿，可重试保存。" : remote.draft ? "已读取账号中的学习记录。" : "已连接账号，输入后自动保存。" })
      this.cache()
      if (this.state.dirty && !this.pending) this.schedule()
    } catch (error) { this.failure(error) }
    finally { this.patch({ busy: false }) }
  }
  update(body: LearningBody) {
    if (this.pending || this.state.busy && !this.state.ready) return
    this.patch({ body, dirty: true, submittedAt: undefined })
    this.cache()
    if (!this.token) this.patch({ message: this.writable ? "草稿已保存在本机；登录后才能同步到账号。" : "当前内容只在页面中，请下载备份。" })
    else { this.patch({ message: this.state.conflict ? "当前草稿已保留，需先处理服务器版本冲突。" : "有新输入，等待保存到账号…" }); this.schedule() }
  }
  private schedule() {
    clearTimeout(this.timer)
    if (this.state.ready && !this.state.conflict) this.timer = setTimeout(() => { void this.save() }, 650)
  }
  private enqueue(work: () => Promise<void>) {
    const next = this.queue.then(work)
    this.queue = next.catch(() => {})
    return next
  }
  private failure(error: unknown) {
    const conflict = error instanceof ApiError && error.status === 409
    this.patch({ conflict, attention: true, message: (error instanceof Error ? error.message : "同步失败，请重试。") + " 当前内容仍保留，可下载。" })
  }
  save = () => this.enqueue(async () => {
    if (!this.token || !this.state.ready || !this.state.dirty || this.pending || this.state.conflict) return
    const body = this.state.body
    this.patch({ busy: true, message: "正在保存到账号…" })
    try {
      const result = await learningRecords.save(this.token, this.scope, body, this.revision)
      this.revision = result.draft!.revision
      const dirty = !equal(body, this.state.body)
      this.patch({ dirty, attention: false, message: dirty ? "先前输入已保存，最新输入等待同步…" : "已保存到账号，可在其他设备继续。" })
      this.cache()
    } catch (error) { this.failure(error) }
    finally { this.patch({ busy: false }) }
  })
  submit = () => this.enqueue(async () => {
    clearTimeout(this.timer)
    if (!this.state.body.answers.length || this.state.body.answers.some(a => !a.answer.trim()) || this.state.conflict) return
    if (!this.token) {
      this.patch({ submittedAt: new Date().toISOString(), dirty: false, message: "本节记录仅存本机，尚未提交到账号。" }); this.cache(); return
    }
    if (!this.state.ready) { this.patch({ message: "尚未读取账号记录，请先重试连接；内容可以下载保存。" }); return }
    this.pending ??= { id: crypto.randomUUID(), body: this.state.body, revision: this.revision }
    this.patch({ busy: true, pending: true, message: "正在提交到账号…" }); this.cache()
    try {
      const result = await learningRecords.submit(this.token, this.scope, this.pending.body, this.pending.revision, this.pending.id)
      this.revision = result.draft?.revision ?? result.submission!.revision
      this.pending = undefined
      this.patch({ pending: false, dirty: false, attention: false, submittedAt: result.submission!.created_at,
        history: [result.submission!, ...this.state.history.filter(s => s.id !== result.submission!.id)].slice(0, 50),
        message: "已提交到账号并保留历史。保存记录不代表已评分或已掌握。" })
      this.cache()
    } catch (error) { this.failure(error) }
    finally { this.patch({ busy: false }) }
  })
  dispose() {
    clearTimeout(this.timer)
    if (this.state.dirty && !this.state.conflict && !this.pending) void this.save()
  }
}
