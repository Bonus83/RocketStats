import { ActionSink } from "./live-runtime.js";
import { KeyRenderModel } from "../render/key-renderer.js";
import { RenderBus } from "../streamdeck/render-bus.js";

export class StreamDeckActionSink implements ActionSink {
  constructor(private readonly bus: RenderBus) {}

  render(model: KeyRenderModel): void {
    this.bus.publish(model);
  }
}
