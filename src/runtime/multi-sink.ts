import { ActionSink } from "./live-runtime.js";
import { KeyRenderModel } from "../render/key-renderer.js";

export class MultiSink implements ActionSink {
  constructor(private readonly sinks: ActionSink[]) {}

  render(model: KeyRenderModel): void {
    for (const sink of this.sinks) {
      sink.render(model);
    }
  }
}
