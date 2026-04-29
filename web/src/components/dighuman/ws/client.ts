// Ported from ~/Dev/systemdighuman/packages/client/src/ws/client.ts
// Thin WebSocket wrapper that decodes server JSON frames and delegates binary
// (audio) frames to a separate handler.
import type { ServerFrame } from "../shared/ws-messages"
import { parseServerFrame } from "../shared/ws-messages"

type Handler<T extends ServerFrame["type"]> = (frame: Extract<ServerFrame, { type: T }>) => void
type BinaryHandler = (data: ArrayBuffer) => void

export interface WsClientOptions {
  factory?: (url: string) => WebSocket
}

export class DighumanWsClient {
  private ws: WebSocket | null = null
  private readonly handlers: Partial<Record<ServerFrame["type"], Handler<ServerFrame["type"]>[]>> = {}
  private readonly binaryHandlers: BinaryHandler[] = []
  private openResolvers: Array<() => void> = []

  constructor(
    private readonly url: string,
    private readonly opts: WsClientOptions = {}
  ) {}

  connect(): void {
    const factory = this.opts.factory ?? ((u: string) => new WebSocket(u))
    this.ws = factory(this.url)
    this.ws.binaryType = "arraybuffer"
    this.ws.addEventListener("message", (ev) => this.handleMessage(ev as MessageEvent))
    this.ws.addEventListener("open", () => {
      const fns = this.openResolvers
      this.openResolvers = []
      for (const fn of fns) fn()
    })
  }

  /** Wait until the underlying WS is OPEN. */
  ready(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return Promise.resolve()
    return new Promise((resolve) => this.openResolvers.push(resolve))
  }

  on<T extends ServerFrame["type"]>(type: T, handler: Handler<T>): void {
    const list = (this.handlers[type] ??= [] as Handler<ServerFrame["type"]>[])
    list.push(handler as unknown as Handler<ServerFrame["type"]>)
  }

  onBinary(handler: BinaryHandler): void {
    this.binaryHandlers.push(handler)
  }

  send(data: string): void {
    this.ws?.send(data)
  }

  close(): void {
    this.ws?.close()
    this.ws = null
  }

  private handleMessage(ev: MessageEvent): void {
    if (typeof ev.data === "string") {
      try {
        const parsed = parseServerFrame(JSON.parse(ev.data))
        if (!parsed) return
        const list = this.handlers[parsed.type]
        if (list) for (const h of list) h(parsed as never)
      } catch {
        // ignore malformed frame
      }
      return
    }
    if (ev.data instanceof ArrayBuffer) {
      for (const h of this.binaryHandlers) h(ev.data)
      return
    }
    if (ev.data instanceof Blob) {
      ev.data.arrayBuffer().then((ab) => {
        for (const h of this.binaryHandlers) h(ab)
      })
    }
  }
}
