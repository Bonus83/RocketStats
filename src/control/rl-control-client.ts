import { Socket } from "node:net";

export interface RlControlClientOptions {
  host: string;
  port: number;
  timeoutMs: number;
}

export class RlControlClient {
  constructor(private options: RlControlClientOptions) {}

  configurePort(port: number): void {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new RangeError("RL control port must be an integer between 1 and 65535.");
    }
    this.options = { ...this.options, port };
  }

  async toggleHud(): Promise<void> {
    await this.sendRawCommand({
      command: "toggle_hud",
      sentAt: Date.now()
    });
  }

  async sendRawCommand(payload: Record<string, unknown>): Promise<void> {
    const socket = new Socket();
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error("RL control command timed out."));
      }, this.options.timeoutMs);

      socket.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });

      socket.connect(this.options.port, this.options.host, () => {
        socket.write(`${JSON.stringify(payload)}\n`);
        socket.end();
      });

      socket.on("close", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}
