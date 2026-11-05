export const RL_STATS_API_PORT = 49123;
export const RL_STATS_API_PACKET_RATE = 30;
export const RL_STATS_API_SECTION = "[TAGame.MatchStatsExporter_TA]";

export function updateStatsApiIni(content) {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.length > 0 ? content.split(/\r?\n/) : [];
  while (lines.length > 0 && lines.at(-1) === "") {
    lines.pop();
  }

  let sectionStart = lines.findIndex(
    (line) => line.trim().toLowerCase() === RL_STATS_API_SECTION.toLowerCase()
  );
  let sectionEnd = -1;

  if (sectionStart < 0) {
    if (lines.length > 0) {
      lines.push("");
    }
    sectionStart = lines.length;
    lines.push(RL_STATS_API_SECTION);
    sectionEnd = lines.length;
  } else {
    for (let index = sectionStart + 1; index < lines.length; index += 1) {
      if (/^\s*\[[^\]]+\]\s*$/.test(lines[index])) {
        sectionEnd = index;
        break;
      }
    }
    if (sectionEnd < 0) {
      sectionEnd = lines.length;
    }
  }

  const required = new Map([
    ["port", String(RL_STATS_API_PORT)],
    ["packetsendrate", String(RL_STATS_API_PACKET_RATE)]
  ]);
  const present = new Set();
  for (let index = sectionStart + 1; index < sectionEnd; index += 1) {
    const keyMatch = /^\s*([^=;#]+?)\s*=/.exec(lines[index]);
    if (!keyMatch) {
      continue;
    }
    const key = keyMatch[1].trim().toLowerCase();
    const value = required.get(key);
    if (value !== undefined) {
      lines[index] = `${keyMatch[1]}=${value}`;
      present.add(key);
    }
  }

  const additions = [];
  for (const [key, value] of required) {
    if (!present.has(key)) {
      additions.push(`${key === "packetsendrate" ? "PacketSendRate" : "Port"}=${value}`);
    }
  }
  let insertionIndex = sectionEnd;
  while (insertionIndex > sectionStart + 1 && lines[insertionIndex - 1].trim() === "") {
    insertionIndex -= 1;
  }
  lines.splice(insertionIndex, 0, ...additions);
  return `${lines.join(newline)}${newline}`;
}

export function isStatsApiIniConfigured(content) {
  return updateStatsApiIni(content) === content;
}
