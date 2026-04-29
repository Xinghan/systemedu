import {
  type Server as HttpServer,
  type IncomingMessage,
  createServer as createHttp,
} from "node:http";
import { parse as parseUrl } from "node:url";
import { type WebSocket, WebSocketServer } from "ws";
import { SessionRegistry } from "./session.js";

export interface WsServerOptions {
  port: number;
  host?: string;
  registry?: SessionRegistry;
}

export interface WsServerHandle {
  httpServer: HttpServer;
  wss: WebSocketServer;
  registry: SessionRegistry;
}

export function createWsServer(opts: WsServerOptions): WsServerHandle {
  const registry = opts.registry ?? new SessionRegistry();
  const httpServer = createHttp();
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const parsed = parseUrl(req.url ?? "", true);
    if (parsed.pathname !== "/ws") {
      socket.destroy();
      return;
    }
    const sessionId = typeof parsed.query.session_id === "string" ? parsed.query.session_id : "";
    if (!sessionId) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      handleConnection(ws, sessionId, registry, req);
    });
  });

  httpServer.listen(opts.port, opts.host ?? "127.0.0.1");
  return { httpServer, wss, registry };
}

function handleConnection(
  ws: WebSocket,
  sessionId: string,
  registry: SessionRegistry,
  _req: IncomingMessage,
): void {
  const send = (data: string | Buffer) => {
    if (ws.readyState === ws.OPEN) ws.send(data);
  };
  registry.register(sessionId, send);

  ws.on("close", () => registry.remove(sessionId));
  ws.on("error", () => registry.remove(sessionId));
}
