export type SendFn = (data: string | Buffer) => void;

export interface Session {
  id: string;
  send: SendFn;
}

export class SessionRegistry {
  private readonly sessions = new Map<string, Session>();

  register(id: string, send: SendFn): void {
    this.sessions.set(id, { id, send });
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  remove(id: string): void {
    this.sessions.delete(id);
  }

  size(): number {
    return this.sessions.size;
  }
}
