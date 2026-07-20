import type { InputKeys, ServerMessage } from "./api";

export type InputFrameHandler = (tick: number, inputs: Array<{ slot: number; keys: InputKeys }>) => void;

export class GameSocket {
  private socket: WebSocket | null = null;
  private listeners = new Set<(message: ServerMessage) => void>();

  connect(url: string) {
    this.disconnect();
    this.socket = new WebSocket(url);

    this.socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data as string) as ServerMessage;
        this.listeners.forEach((listener) => listener(message));
      } catch {
        // ignore malformed payloads
      }
    });

    return new Promise<void>((resolve, reject) => {
      if (!this.socket) return reject(new Error("Socket missing"));

      this.socket.addEventListener("open", () => resolve(), { once: true });
      this.socket.addEventListener(
        "error",
        () => reject(new Error("WebSocket connection failed")),
        { once: true },
      );
    });
  }

  onMessage(listener: (message: ServerMessage) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  send(message: Record<string, unknown>) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  sendInput(tick: number, keys: InputKeys) {
    this.send({ type: "input", tick, keys });
  }

  requestGameStart() {
    this.send({ type: "game_start" });
  }

  ping() {
    this.send({ type: "ping" });
  }

  disconnect() {
    this.listeners.clear();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  get connected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}
