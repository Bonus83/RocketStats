import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginDirectory = join(root, "com.rocketstats.livestats.sdPlugin");
const manifest = JSON.parse(
  await readFile(join(pluginDirectory, "manifest.json"), "utf8")
);

const LABELS = {
  "score": "SC",
  "timer": "TIME",
  "boost": "BST",
  "streak": "W L",
  "mmr": "MMR",
  "banner": "EVT",
  "last-goal": "GOAL",
  "queue": "QUEUE",
  "ban": "BAN",
  "speed": "SPD",
  "ping": "PING",
  "possession": "BALL",
  "hud": "HUD",
  "hud-toggle": "HUD",
  "records": "REC",
  "goals": "GOAL",
  "assists": "AST",
  "saves": "SAVE",
  "shots": "SHOT",
  "demos": "DEMO",
  "flip-resets": "FLIP",
  "touches": "TOUCH",
  "player-score": "PTS",
  "stats-scope": "W L",
  "stats-reset": "RESET",
  "rank": "RANK",
  "mmr-wl": "MMR",
  "icon": "RL",
  "category": "RL"
};

const COLORS = [
  "#2f80ed", "#00b894", "#f1c40f", "#9b59b6", "#3498db",
  "#e84393", "#16a085", "#e17055", "#0984e3", "#00cec9",
  "#6c5ce7", "#d63031", "#27ae60", "#2980b9", "#8e44ad",
  "#f39c12", "#c0392b", "#1abc9c", "#e67e22", "#2ecc71",
  "#34495e", "#c0392b"
];

const FONT = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"]
};

const DEVICE_PROFILES = [
  {
    name: "profiles/stream-deck",
    title: "Rocket League Stats - Stream Deck",
    model: "20GAA9901",
    deviceType: 0,
    columns: 5,
    rows: 3,
    actions: [
      "score", "timer", "boost", "banner", "streak",
      "mmr-wl", "queue", "ban", "speed", "ping",
      "possession", "rank", "goals", "assists", "saves"
    ]
  },
  {
    name: "profiles/stream-deck-variant",
    title: "Rocket League Stats - Stream Deck (20GAA9902)",
    model: "20GAA9902",
    deviceType: 0,
    columns: 5,
    rows: 3,
    actions: [
      "score", "timer", "boost", "banner", "streak",
      "mmr-wl", "queue", "ban", "speed", "ping",
      "possession", "rank", "goals", "assists", "saves"
    ]
  },
  {
    name: "profiles/stream-deck-mini",
    title: "Rocket League Stats - Stream Deck Mini",
    model: "20GAI9901",
    deviceType: 1,
    columns: 3,
    rows: 2,
    actions: ["score", "timer", "boost", "banner", "streak", "mmr-wl"]
  },
  {
    name: "profiles/stream-deck-xl",
    title: "Rocket League Stats - Stream Deck XL",
    model: "20GAT9901",
    deviceType: 2,
    columns: 8,
    rows: 4,
    actions: [
      "score", "timer", "boost", "banner", "streak", "mmr", "queue", "ban",
      "speed", "ping", "possession", "records", "goals", "assists", "saves",
      "shots", "demos", "flip-resets", "touches", "player-score", "hud-toggle",
      "stats-scope", "stats-reset", "rank", "mmr-wl", "last-goal"
    ]
  },
  {
    name: "profiles/stream-deck-xl-variant",
    title: "Rocket League Stats - Stream Deck XL (20GAT9902)",
    model: "20GAT9902",
    deviceType: 2,
    columns: 8,
    rows: 4,
    actions: [
      "score", "timer", "boost", "banner", "streak", "mmr", "queue", "ban",
      "speed", "ping", "possession", "records", "goals", "assists", "saves",
      "shots", "demos", "flip-resets", "touches", "player-score", "hud-toggle",
      "stats-scope", "stats-reset", "rank", "mmr-wl", "last-goal"
    ]
  },
  {
    name: "profiles/stream-deck-plus",
    title: "Rocket League Stats - Stream Deck +",
    model: "20GBD9901",
    deviceType: 7,
    columns: 4,
    rows: 2,
    actions: ["score", "timer", "boost", "banner", "streak", "mmr-wl", "queue", "rank"]
  },
  {
    name: "profiles/stream-deck-neo",
    title: "Rocket League Stats - Stream Deck Neo",
    model: "20GEA9901",
    deviceType: 9,
    columns: 4,
    rows: 2,
    actions: ["score", "timer", "boost", "banner", "streak", "mmr-wl", "queue", "rank"]
  },
  {
    name: "profiles/stream-deck-studio",
    title: "Rocket League Stats - Stream Deck Studio",
    model: "10GBO9901",
    deviceType: 10,
    columns: 16,
    rows: 2,
    actions: [
      "score", "timer", "boost", "banner", "streak", "mmr", "queue", "ban",
      "speed", "ping", "possession", "records", "goals", "assists", "saves",
      "shots", "demos", "flip-resets", "touches", "player-score", "hud-toggle",
      "stats-scope", "stats-reset", "rank", "mmr-wl", "last-goal"
    ]
  }
];

function parseHexColor(hex) {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
    255
  ];
}

function fillRect(pixels, width, height, x, y, rectWidth, rectHeight, color) {
  const [red, green, blue, alpha] = color;
  for (let row = Math.max(0, y); row < Math.min(height, y + rectHeight); row += 1) {
    for (let column = Math.max(0, x); column < Math.min(width, x + rectWidth); column += 1) {
      const offset = (row * width + column) * 4;
      pixels[offset] = red;
      pixels[offset + 1] = green;
      pixels[offset + 2] = blue;
      pixels[offset + 3] = alpha;
    }
  }
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  name.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return chunk;
}

function paethPredictor(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) {
    return left;
  }
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function decodeRgbaPng(png) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (png.length < 8 || !png.subarray(0, 8).equals(signature)) {
    throw new Error("Logo sheet is not a PNG image.");
  }

  let width;
  let height;
  let bitDepth;
  let colorType;
  let interlaceMethod;
  const imageData = [];
  let offset = 8;
  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > png.length) {
      throw new Error(`Logo sheet has a truncated ${type} chunk.`);
    }

    if (type === "IHDR") {
      width = png.readUInt32BE(dataStart);
      height = png.readUInt32BE(dataStart + 4);
      bitDepth = png[dataStart + 8];
      colorType = png[dataStart + 9];
      interlaceMethod = png[dataStart + 12];
    } else if (type === "IDAT") {
      imageData.push(png.subarray(dataStart, dataEnd));
    } else if (type === "IEND") {
      break;
    }
    offset = dataEnd + 4;
  }

  if (
    !width ||
    !height ||
    bitDepth !== 8 ||
    colorType !== 6 ||
    interlaceMethod !== 0 ||
    imageData.length === 0
  ) {
    throw new Error("Logo sheet must be a non-interlaced 8-bit RGBA PNG.");
  }

  const rowLength = width * 4;
  const filtered = inflateSync(Buffer.concat(imageData));
  if (filtered.length !== height * (rowLength + 1)) {
    throw new Error("Logo sheet has an invalid decompressed pixel length.");
  }

  const pixels = Buffer.alloc(height * rowLength);
  const previousRow = Buffer.alloc(rowLength);
  const currentRow = Buffer.alloc(rowLength);
  for (let y = 0; y < height; y += 1) {
    const sourceOffset = y * (rowLength + 1);
    const filter = filtered[sourceOffset];
    for (let index = 0; index < rowLength; index += 1) {
      const left = index >= 4 ? currentRow[index - 4] : 0;
      const above = previousRow[index];
      const upperLeft = index >= 4 ? previousRow[index - 4] : 0;
      let predictor = 0;
      if (filter === 1) {
        predictor = left;
      } else if (filter === 2) {
        predictor = above;
      } else if (filter === 3) {
        predictor = Math.floor((left + above) / 2);
      } else if (filter === 4) {
        predictor = paethPredictor(left, above, upperLeft);
      } else if (filter !== 0) {
        throw new Error(`Logo sheet uses an unsupported PNG filter (${filter}).`);
      }
      currentRow[index] = (filtered[sourceOffset + 1 + index] + predictor) & 0xff;
    }
    currentRow.copy(pixels, y * rowLength);
    currentRow.copy(previousRow);
  }

  return { width, height, pixels };
}

function findLogoCards(image, alphaThreshold, padding) {
  const { width, height, pixels } = image;
  const visited = new Uint8Array(width * height);
  const pending = [];
  const cards = [];

  for (let start = 0; start < visited.length; start += 1) {
    if (visited[start] || pixels[start * 4 + 3] <= alphaThreshold) {
      continue;
    }

    visited[start] = 1;
    pending.push(start);
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let area = 0;

    while (pending.length > 0) {
      const index = pending.pop();
      const x = index % width;
      const y = Math.floor(index / width);
      area += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      const visit = (neighbor) => {
        if (
          neighbor >= 0 &&
          neighbor < visited.length &&
          !visited[neighbor] &&
          pixels[neighbor * 4 + 3] > alphaThreshold
        ) {
          visited[neighbor] = 1;
          pending.push(neighbor);
        }
      };
      if (x > 0) visit(index - 1);
      if (x + 1 < width) visit(index + 1);
      if (y > 0) visit(index - width);
      if (y + 1 < height) visit(index + width);
    }

    if (area > 1000) {
      const x = Math.max(0, minX - padding);
      const y = Math.max(0, minY - padding);
      const right = Math.min(width, maxX + 1 + padding);
      const bottom = Math.min(height, maxY + 1 + padding);
      cards.push({ x, y, width: right - x, height: bottom - y });
    }
  }

  return cards.sort((left, right) => left.y - right.y || left.x - right.x);
}

function resizeRgba(source, sourceWidth, sourceHeight, size) {
  const output = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const sourceY = Math.max(
      0,
      Math.min(sourceHeight - 1, (y + 0.5) * sourceHeight / size - 0.5)
    );
    const y0 = Math.floor(sourceY);
    const y1 = Math.min(sourceHeight - 1, y0 + 1);
    const yWeight = sourceY - y0;
    for (let x = 0; x < size; x += 1) {
      const sourceX = Math.max(
        0,
        Math.min(sourceWidth - 1, (x + 0.5) * sourceWidth / size - 0.5)
      );
      const x0 = Math.floor(sourceX);
      const x1 = Math.min(sourceWidth - 1, x0 + 1);
      const xWeight = sourceX - x0;
      const samples = [
        [y0 * sourceWidth + x0, (1 - xWeight) * (1 - yWeight)],
        [y0 * sourceWidth + x1, xWeight * (1 - yWeight)],
        [y1 * sourceWidth + x0, (1 - xWeight) * yWeight],
        [y1 * sourceWidth + x1, xWeight * yWeight]
      ];
      let alpha = 0;
      const color = [0, 0, 0];
      for (const [pixel, weight] of samples) {
        const sourceOffset = pixel * 4;
        const sampleAlpha = source[sourceOffset + 3] / 255;
        const alphaWeight = sampleAlpha * weight;
        alpha += alphaWeight;
        for (let channel = 0; channel < 3; channel += 1) {
          color[channel] += source[sourceOffset + channel] * alphaWeight;
        }
      }

      const outputOffset = (y * size + x) * 4;
      if (alpha > 0) {
        output[outputOffset] = Math.round(color[0] / alpha);
        output[outputOffset + 1] = Math.round(color[1] / alpha);
        output[outputOffset + 2] = Math.round(color[2] / alpha);
      }
      output[outputOffset + 3] = Math.round(alpha * 255);
    }
  }
  return output;
}

function makeLogoPng(image, card, size, splitTeamColors = false) {
  const cropped = Buffer.alloc(card.width * card.height * 4);
  for (let row = 0; row < card.height; row += 1) {
    const sourceOffset = ((card.y + row) * image.width + card.x) * 4;
    image.pixels.copy(cropped, row * card.width * 4, sourceOffset, sourceOffset + card.width * 4);
  }
  const pixels = resizeRgba(cropped, card.width, card.height, size);
  if (splitTeamColors) {
    const markerHeight = Math.max(2, Math.ceil(size / 36));
    fillRect(pixels, size, size, 0, size - markerHeight, Math.floor(size / 2), markerHeight, parseHexColor("#2F77FF"));
    fillRect(pixels, size, size, Math.floor(size / 2), size - markerHeight, size - Math.floor(size / 2), markerHeight, parseHexColor("#D07A21"));
    fillRect(pixels, size, size, Math.floor(size / 2) - 1, size - markerHeight, 2, markerHeight, parseHexColor("#101b2c"));
  }
  return encodePng(size, pixels);
}

function encodePng(size, pixels) {
  const rowLength = size * 4;
  const raw = Buffer.alloc(size * (rowLength + 1));
  for (let row = 0; row < size; row += 1) {
    const offset = row * (rowLength + 1);
    raw[offset] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + row * rowLength, rowLength).copy(raw, offset + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function makePng(size, label, accentHex, splitTeamColors = false) {
  const background = parseHexColor("#101b2c");
  const accent = parseHexColor(accentHex);
  const white = parseHexColor("#f4f7fb");
  const pixels = new Uint8Array(size * size * 4);
  if (splitTeamColors) {
    fillRect(
      pixels,
      size,
      size,
      0,
      0,
      Math.floor(size / 2),
      size,
      parseHexColor("#2F77FF")
    );
    fillRect(
      pixels,
      size,
      size,
      Math.floor(size / 2),
      0,
      size - Math.floor(size / 2),
      size,
      parseHexColor("#D07A21")
    );
    fillRect(pixels, size, size, Math.floor(size / 2) - 1, 0, 2, size, background);
  } else {
    fillRect(pixels, size, size, 0, 0, size, size, background);
    fillRect(pixels, size, size, 0, 0, Math.ceil(size / 18), size, accent);
    fillRect(
      pixels,
      size,
      size,
      0,
      size - Math.ceil(size / 24),
      size,
      Math.ceil(size / 24),
      accent
    );
    fillRect(
      pixels,
      size,
      size,
      Math.ceil(size * 0.22),
      Math.ceil(size * 0.19),
      Math.floor(size * 0.56),
      Math.ceil(size / 36),
      accent
    );
  }

  const scale = size >= 128 ? 3 : 2;
  const textWidth = label.length === 0 ? 0 : label.length * 5 + (label.length - 1);
  const startX = Math.floor((size - textWidth * scale) / 2);
  const startY = Math.floor((size - 7 * scale) / 2) + Math.ceil(size * 0.07);
  for (let index = 0; index < label.length; index += 1) {
    const glyph = FONT[label[index]] ?? FONT[" "];
    for (let row = 0; row < glyph.length; row += 1) {
      for (let column = 0; column < glyph[row].length; column += 1) {
        if (glyph[row][column] === "1") {
          fillRect(
            pixels,
            size,
            size,
            startX + (index * 6 + column) * scale,
            startY + row * scale,
            scale,
            scale,
            white
          );
        }
      }
    }
  }

  return encodePng(size, pixels);
}

function makeZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const dosDate = 0x0021;

  for (const entry of entries) {
    const filename = Buffer.from(entry.name, "utf8");
    const data = entry.data;
    const checksum = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(filename.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, filename, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(filename.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(entry.name.endsWith("/") ? 0x10 << 16 : 0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, filename);
    offset += localHeader.length + filename.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, endRecord]);
}

function actionId(uuid) {
  return uuid.slice(uuid.lastIndexOf(".") + 1);
}

function stateTemplate() {
  return {
    FFamily: "",
    FSize: "12",
    FStyle: "",
    FUnderline: "off",
    Image: "",
    Title: "",
    TitleAlignment: "middle",
    TitleColor: "#ffffff",
    TitleShow: ""
  };
}

function makeRankPngs(image, catalog, size) {
  const { columns, rows } = catalog.layout;
  const cellWidth = image.width / columns;
  const cellHeight = image.height / rows;
  const result = [];
  for (const rank of catalog.ranks) {
    const column = rank.index % columns;
    const row = Math.floor(rank.index / columns);
    const left = Math.floor(column * cellWidth);
    const top = Math.floor(row * cellHeight);
    const right = Math.floor((column + 1) * cellWidth);
    const bottom = Math.floor((row + 1) * cellHeight);
    let minX = right;
    let minY = bottom;
    let maxX = -1;
    let maxY = -1;
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        if (image.pixels[(y * image.width + x) * 4 + 3] > 24) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (maxX < 0) {
      throw new Error(`Rank sheet cell ${rank.index} (${rank.name}) is empty.`);
    }

    // Center the icon on a square canvas with a small margin; pixels outside the cell stay transparent.
    const side = Math.ceil(Math.max(maxX - minX + 1, maxY - minY + 1) * 1.12);
    const originX = Math.round((minX + maxX + 1) / 2 - side / 2);
    const originY = Math.round((minY + maxY + 1) / 2 - side / 2);
    const square = Buffer.alloc(side * side * 4);
    for (let y = 0; y < side; y += 1) {
      const sourceY = originY + y;
      if (sourceY < top || sourceY >= bottom) continue;
      for (let x = 0; x < side; x += 1) {
        const sourceX = originX + x;
        if (sourceX < left || sourceX >= right) continue;
        image.pixels.copy(
          square,
          (y * side + x) * 4,
          (sourceY * image.width + sourceX) * 4,
          (sourceY * image.width + sourceX) * 4 + 4
        );
      }
    }
    result.push(encodePng(size, resizeRgba(square, side, side, size)));
  }
  return result;
}

async function loadRankIcons() {
  const catalog = JSON.parse(await readFile(join(root, "assets", "ranks", "catalog.json"), "utf8"));
  const sourcePng = await readFile(join(root, "assets", "ranks", catalog.source.file));
  const sourceHash = createHash("sha256").update(sourcePng).digest("hex");
  if (sourceHash !== catalog.source.sha256) {
    throw new Error("Rank sheet does not match the SHA-256 recorded in its catalog.");
  }
  const sheet = decodeRgbaPng(sourcePng);
  if (sheet.width !== catalog.source.width || sheet.height !== catalog.source.height) {
    throw new Error("Rank sheet dimensions do not match its catalog.");
  }
  catalog.ranks.forEach((rank, index) => {
    if (rank.index !== index) {
      throw new Error("Rank catalog indices must be consecutive and start at 0.");
    }
  });
  return {
    catalog,
    large: makeRankPngs(sheet, catalog, catalog.output.sizePx),
    small: makeRankPngs(sheet, catalog, 72)
  };
}

async function generateRankIcons(rankIcons) {
  const directory = join(pluginDirectory, rankIcons.catalog.output.directory);
  await mkdir(directory, { recursive: true });
  for (const [index, png] of rankIcons.large.entries()) {
    await writeFile(join(directory, `rank-${String(index).padStart(2, "0")}.png`), png);
  }
}

// Default artwork for the rank action in the action list and on fresh keys.
const RANK_ACTION_PREVIEW_INDEX = 19;

async function generateIcons(rankIcons) {
  const requested = new Map();
  const catalogPath = join(root, "assets", "logos", "catalog.json");
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  const sourcePath = join(root, "assets", "logos", catalog.source.file);
  const sourcePng = await readFile(sourcePath);
  const sourceHash = createHash("sha256").update(sourcePng).digest("hex");
  if (sourceHash !== catalog.source.sha256) {
    throw new Error("Logo sheet does not match the SHA-256 recorded in its catalog.");
  }
  const logoSheet = decodeRgbaPng(sourcePng);
  if (logoSheet.width !== catalog.source.width || logoSheet.height !== catalog.source.height) {
    throw new Error("Logo sheet dimensions do not match its catalog.");
  }
  const logoCards = findLogoCards(
    logoSheet,
    catalog.layout.cropDetection.alphaThreshold,
    catalog.layout.cropDetection.paddingPx
  );
  if (logoCards.length !== catalog.logos.length) {
    throw new Error(
      `Logo sheet contains ${logoCards.length} detectable cards, but the catalog lists ${catalog.logos.length}.`
    );
  }
  const logoById = new Map();
  for (const [index, logo] of catalog.logos.entries()) {
    if (logo.index !== index + 1 || logoById.has(logo.id)) {
      throw new Error("Logo catalog indices must be consecutive and IDs must be unique.");
    }
    logoById.set(logo.id, { ...logo, crop: logoCards[index] });
  }

  for (const path of [manifest.Icon, manifest.CategoryIcon]) {
    requested.set(path, { name: path.split("/").at(-1), size: 72 });
  }
  for (const action of manifest.Actions) {
    const id = actionId(action.UUID);
    // Actions without an appended logo in the sheet yet fall back to generated label artwork.
    const logoId = logoById.has(id) ? id : undefined;
    if (!logoId && !LABELS[id]) {
      throw new Error(`Missing logo catalog entry or fallback label for action "${id}".`);
    }
    requested.set(action.Icon, { name: id, size: 72 });
    for (const state of action.States ?? []) {
      requested.set(state.Image, { name: id, size: 144, logoId, keyFallback: !logoId });
    }
  }

  let colorIndex = 0;
  for (const [assetPath, asset] of requested) {
    const label = LABELS[asset.name] ?? "RL";
    const color = COLORS[colorIndex % COLORS.length];
    colorIndex += 1;
    const output = join(pluginDirectory, `${assetPath}.png`);
    await mkdir(dirname(output), { recursive: true });
    const png = asset.name === "rank"
      ? (asset.size > 72 ? rankIcons.large : rankIcons.small)[RANK_ACTION_PREVIEW_INDEX]
      : asset.logoId
      ? makeLogoPng(
        logoSheet,
        logoById.get(asset.logoId).crop,
        asset.size,
        asset.logoId === "score"
      )
      : makePng(asset.size, asset.keyFallback ? "" : label, color, asset.name === "score");
    await writeFile(output, png);
  }
}

async function generateProfiles() {
  const actionsById = new Map(manifest.Actions.map((action) => [actionId(action.UUID), action]));
  for (const profile of DEVICE_PROFILES) {
    const profileReference = manifest.Profiles.find((item) => item.Name === profile.name);
    if (!profileReference || profileReference.DeviceType !== profile.deviceType) {
      throw new Error(`Missing manifest profile reference: ${profile.name}`);
    }

    const actions = {};
    for (const [index, id] of profile.actions.entries()) {
      const action = actionsById.get(id);
      if (!action) {
        throw new Error(`Unknown action "${id}" in ${profile.name}`);
      }
      const column = index % profile.columns;
      const row = Math.floor(index / profile.columns);
      actions[`${column},${row}`] = {
        Name: action.Name,
        Settings: {},
        State: 0,
        States: [stateTemplate()],
        UUID: action.UUID
      };
    }

    const profileManifest = {
      Actions: actions,
      DeviceModel: profile.model,
      Name: profile.title,
      Version: "1.0"
    };
    const profileId = createHash("sha1")
      .update(`${manifest.UUID}:${profile.name}`)
      .digest("hex")
      .slice(0, 32)
      .toUpperCase()
      .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
    const internalRoot = `${profileId}.sdProfile`;
    const entries = [];
    for (let row = 0; row < profile.rows; row += 1) {
      for (let column = 0; column < profile.columns; column += 1) {
        entries.push({ name: `${internalRoot}/${column},${row}/`, data: Buffer.alloc(0) });
      }
    }
    entries.push({
      name: `${internalRoot}/manifest.json`,
      data: Buffer.from(`${JSON.stringify(profileManifest, null, 2)}\n`, "utf8")
    });

    const output = join(pluginDirectory, `${profile.name}.streamDeckProfile`);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, makeZip(entries));
  }

  const legacyProfile = join(
    pluginDirectory,
    "profiles",
    "stream-deck-mk2.streamDeckProfile"
  );
  await unlink(legacyProfile).catch((error) => {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
  });
}

const rankIcons = await loadRankIcons();
await generateRankIcons(rankIcons);
await generateIcons(rankIcons);
await generateProfiles();
console.log(
  `Generated ${manifest.Actions.length * 2 + 2} PNG assets, ${rankIcons.large.length} rank icons and ${DEVICE_PROFILES.length} Stream Deck profiles.`
);
