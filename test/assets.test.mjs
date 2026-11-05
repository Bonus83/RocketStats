import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

const pluginDirectory = join(
  process.cwd(),
  "com.rocketstats.livestats.sdPlugin"
);
const manifest = JSON.parse(
  await readFile(join(pluginDirectory, "manifest.json"), "utf8")
);
const logoCatalog = JSON.parse(
  await readFile(join(process.cwd(), "assets", "logos", "catalog.json"), "utf8")
);

function unzipStoredEntries(zip) {
  const entries = new Map();
  let offset = 0;
  while (offset + 4 <= zip.length && zip.readUInt32LE(offset) === 0x04034b50) {
    const method = zip.readUInt16LE(offset + 8);
    const compressedSize = zip.readUInt32LE(offset + 18);
    const filenameLength = zip.readUInt16LE(offset + 26);
    const extraLength = zip.readUInt16LE(offset + 28);
    const filenameOffset = offset + 30;
    const filename = zip.toString("utf8", filenameOffset, filenameOffset + filenameLength);
    const bodyOffset = filenameOffset + filenameLength + extraLength;
    assert.equal(method, 0, "profile ZIP entries should use the supported store method");
    entries.set(filename, zip.subarray(bodyOffset, bodyOffset + compressedSize));
    offset = bodyOffset + compressedSize;
  }
  return entries;
}

function validatePng(png) {
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  let offset = 8;
  let width;
  let height;
  const imageData = [];
  let sawEnd = false;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === "IDAT") {
      imageData.push(data);
    } else if (type === "IEND") {
      sawEnd = true;
    }
    offset += length + 12;
  }
  assert.equal(sawEnd, true);
  assert.ok(width > 0 && height > 0);
  const pixels = inflateSync(Buffer.concat(imageData));
  assert.equal(pixels.length, height * (width * 4 + 1));
  return { width, height, pixels };
}

test("manifest image references resolve to valid generated PNG assets", async () => {
  const imagePaths = new Set([manifest.Icon, manifest.CategoryIcon]);
  for (const action of manifest.Actions) {
    imagePaths.add(action.Icon);
    for (const state of action.States ?? []) {
      imagePaths.add(state.Image);
    }
  }

  for (const imagePath of imagePaths) {
    assert.ok(imagePath, "manifest image references must not be empty");
    const png = await readFile(join(pluginDirectory, `${imagePath}.png`));
    const { width, height } = validatePng(png);
    assert.ok(width === 72 || width === 144);
    assert.equal(width, height);
  }
});

test("button artwork maps every catalog logo to a unique action key image", async () => {
  const source = await readFile(
    join(process.cwd(), "assets", "logos", logoCatalog.source.file)
  );
  assert.equal(
    createHash("sha256").update(source).digest("hex"),
    logoCatalog.source.sha256
  );
  const actionsById = new Map(
    manifest.Actions.map((action) => [
      action.UUID.split(".").at(-1),
      action
    ])
  );
  assert.ok(logoCatalog.logos.length <= actionsById.size);

  const imageHashes = new Set();
  for (const logo of logoCatalog.logos) {
    const action = actionsById.get(logo.id);
    assert.ok(action, `logo ${logo.id} must map to a manifest action`);
    const imagePath = action.States[0].Image;
    const png = await readFile(join(pluginDirectory, `${imagePath}.png`));
    const { width, pixels } = validatePng(png);
    assert.equal(width, 144);
    assert.ok(
      pixels.some((channel, index) => index % 4 === 3 && channel > 0),
      `logo ${logo.id} must render visible artwork`
    );
    imageHashes.add(createHash("sha256").update(png).digest("hex"));
  }
  assert.equal(imageHashes.size, logoCatalog.logos.length);
});

test("score button keeps the blue/orange team marker with its logo artwork", async () => {
  const scoreAction = manifest.Actions.find(
    (action) => action.UUID === "com.rocketstats.livestats.score"
  );
  const png = await readFile(
    join(pluginDirectory, `${scoreAction.States[0].Image}.png`)
  );
  const { width, pixels } = validatePng(png);
  const pixelAt = (x, y) => {
    const offset = y * (width * 4 + 1) + 1 + x * 4;
    return [...pixels.subarray(offset, offset + 4)];
  };

  assert.deepEqual(pixelAt(Math.floor(width / 4), width - 2), [47, 119, 255, 255]);
  assert.deepEqual(pixelAt(Math.floor(width * 3 / 4), width - 2), [208, 122, 33, 255]);
});

test("generated profiles target each manifest device and only registered actions", async () => {
  const actionUuids = new Set(manifest.Actions.map((action) => action.UUID));
  const expectedDimensions = new Map([
    ["stream-deck", { dimensions: [5, 3], deviceType: 0, model: "20GAA9901" }],
    ["stream-deck-variant", { dimensions: [5, 3], deviceType: 0, model: "20GAA9902" }],
    ["stream-deck-mini", { dimensions: [3, 2], deviceType: 1, model: "20GAI9901" }],
    ["stream-deck-xl", { dimensions: [8, 4], deviceType: 2, model: "20GAT9901" }],
    ["stream-deck-xl-variant", { dimensions: [8, 4], deviceType: 2, model: "20GAT9902" }],
    ["stream-deck-plus", { dimensions: [4, 2], deviceType: 7, model: "20GBD9901" }],
    ["stream-deck-neo", { dimensions: [4, 2], deviceType: 9, model: "20GEA9901" }],
    ["stream-deck-studio", { dimensions: [16, 2], deviceType: 10, model: "10GBO9901" }]
  ]);
  assert.equal(manifest.Profiles.length, expectedDimensions.size);
  const profileFiles = (await readdir(join(pluginDirectory, "profiles")))
    .filter((name) => name.endsWith(".streamDeckProfile"))
    .sort();
  assert.deepEqual(
    profileFiles,
    [...expectedDimensions.keys()]
      .map((name) => `${name}.streamDeckProfile`)
      .sort()
  );

  for (const profileReference of manifest.Profiles) {
    const profileName = profileReference.Name.split("/").at(-1);
    const profileFile = join(
      pluginDirectory,
      `${profileReference.Name}.streamDeckProfile`
    );
    const zip = await readFile(profileFile);
    assert.equal(zip.readUInt32LE(0), 0x04034b50);
    assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
    const entries = unzipStoredEntries(zip);
    const manifestEntry = [...entries.entries()].find(([name]) =>
      name.endsWith("/manifest.json")
    );
    assert.ok(manifestEntry, `profile ${profileName} needs an embedded manifest`);

    const profile = JSON.parse(manifestEntry[1].toString("utf8"));
    const expected = expectedDimensions.get(profileName);
    const [columns, rows] = expected.dimensions;
    assert.equal(profileReference.DeviceType, expected.deviceType);
    assert.equal(profile.Actions && typeof profile.Actions, "object");
    assert.equal(profile.DeviceModel, expected.model);
    assert.ok(profile.Name.startsWith("Rocket League Stats"));
    assert.ok(Object.keys(profile.Actions).length > 0);
    for (const [coordinate, action] of Object.entries(profile.Actions)) {
      const [column, row] = coordinate.split(",").map(Number);
      assert.ok(column >= 0 && column < columns);
      assert.ok(row >= 0 && row < rows);
      assert.ok(actionUuids.has(action.UUID), `profile action ${action.UUID} must exist in the plugin`);
      if (action.UUID === "com.rocketstats.livestats.mmr") {
        assert.deepEqual(action.Settings, {}, "profile MMR actions should use automatic selection");
      }
    }
  }
});
