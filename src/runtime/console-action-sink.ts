import { ActionSink } from "./live-runtime.js";
import { KeyRenderModel } from "../render/key-renderer.js";

export class ConsoleActionSink implements ActionSink {
  render(model: KeyRenderModel): void {
    const output = `[${model.action}] ${model.title} | ${model.value} | ${model.footer} | ${model.accent}`;
    process.stdout.write(`${output}\n`);
  }
}
