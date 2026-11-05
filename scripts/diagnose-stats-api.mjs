import { Socket } from "node:net";
import { StringDecoder } from "node:string_decoder";

const DEFAULT_PORT = 49123;
const DEFAULT_DURATION_MS = 5000;
const MAX_BUFFER_LENGTH = 1024 * 1024;

function readOptions(args) {
  const options = { host: "127.0.0.1", port: DEFAULT_PORT, durationMs: DEFAULT_DURATION_MS };
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    const value = args[index + 1];
    if (option === "--port" && value) {
      options.port = Number(value);
      index += 1;
    } else if (option === "--duration-ms" && value) {
      options.durationMs = Number(value);
      index += 1;
    } else {
      throw new Error(`Unknown argument "${option}". Use --port or --duration-ms.`);
    }
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
    throw new RangeError("Port must be an integer between 1 and 65535.");
  }
  if (!Number.isInteger(options.durationMs) || options.durationMs < 250 || options.durationMs > 60_000) {
    throw new RangeError("Duration must be between 250 and 60000 milliseconds.");
  }
  return options;
}

function findObjectEnd(buffer) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < buffer.length; index += 1) {
    const character = buffer[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === "\"") {
        inString = false;
      }
      continue;
    }
    if (character === "\"") {
      inString = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }
  }
  return undefined;
}

function createProbe(options) {
  const socket = new Socket();
  const decoder = new StringDecoder("utf8");
  const events = new Map();
  let buffer = "";
  let timer;
  let settled = false;

  return new Promise((resolve, reject) => {
    const finish = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (error) {
        reject(error);
      } else {
        resolve(events);
      }
    };

    socket.once("connect", () => {
      console.log(`Connected to ${options.host}:${options.port}; observing for ${options.durationMs} ms.`);
      timer = setTimeout(() => finish(), options.durationMs);
    });

    socket.on("data", (chunk) => {
      buffer += decoder.write(chunk);
      if (buffer.length > MAX_BUFFER_LENGTH) {
        finish(new Error("Stats API data exceeded the 1 MiB diagnostic buffer limit."));
        return;
      }
      while (buffer.length > 0) {
        const firstContent = buffer.search(/\S/);
        if (firstContent < 0) {
          buffer = "";
          break;
        }
        buffer = buffer.slice(firstContent);
        if (buffer[0] !== "{") {
          const nextObject = buffer.indexOf("{");
          if (nextObject < 0) {
            buffer = "";
            break;
          }
          buffer = buffer.slice(nextObject);
        }
        const frameEnd = findObjectEnd(buffer);
        if (frameEnd === undefined) {
          break;
        }
        const frame = buffer.slice(0, frameEnd);
        buffer = buffer.slice(frameEnd);
        try {
          const payload = JSON.parse(frame);
          if (typeof payload.Event === "string" && payload.Event.length > 0) {
            events.set(payload.Event, (events.get(payload.Event) ?? 0) + 1);
          }
        } catch {
          console.error("Skipped an invalid JSON object; payload contents were not printed.");
        }
      }
    });

    socket.once("error", finish);
    socket.once("close", () => finish());
    socket.connect(options.port, options.host);
  });
}

async function main() {
  const options = readOptions(process.argv.slice(2));
  const events = await createProbe(options);
  if (events.size === 0) {
    console.error("Connected, but no Stats API events arrived during the observation window.");
    console.error("Check that Rocket League is running and the Stats API configuration is active.");
    process.exitCode = 2;
    return;
  }
  const summary = [...events.entries()]
    .map(([name, count]) => `${name} (${count})`)
    .join(", ");
  console.log(`Received ${[...events.values()].reduce((total, count) => total + count, 0)} events: ${summary}`);
  console.log("Only event names and counts were displayed; player data was not logged.");
}

main().catch((error) => {
  console.error(`Stats API diagnostic failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
