function parseUpdateConfig(input) {
  if (
    !input || typeof input !== "object" || Array.isArray(input) ||
    Object.keys(input).some((key) => !["owner", "repo", "publisherNames"].includes(key)) ||
    typeof input.owner !== "string" || typeof input.repo !== "string" ||
    !Array.isArray(input.publisherNames) ||
    !input.publisherNames.every((name) => typeof name === "string" && name.trim().length > 0)
  ) {
    throw new Error("Invalid desktop/update-config.json: expected owner, repo and publisherNames.");
  }
  const owner = input.owner.trim();
  const repo = input.repo.trim();
  const publisherNames = input.publisherNames.map((name) => name.trim());
  if (!owner && !repo && publisherNames.length === 0) return null;
  if (
    !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(owner) ||
    !/^[a-zA-Z0-9_.-]+$/.test(repo) || repo.length > 100 || repo === "." || repo === ".."
  ) {
    throw new Error(
      "Configure a valid public GitHub release repository (owner/repo)."
    );
  }
  return { owner, repo, publisherNames };
}

function desktopBuildConfig(config, requireRelease) {
  const signingReady = Boolean(config?.publisherNames.length);
  if (requireRelease && !signingReady) {
    throw new Error(
      "A signed release requires the exact code-signing certificate publisherNames in desktop/update-config.json."
    );
  }
  return {
    forceCodeSigning: signingReady,
    publish: signingReady
      ? [{ provider: "github", owner: config.owner, repo: config.repo, private: false, releaseType: "release" }]
      : null,
    win: {
      verifyUpdateCodeSignature: true,
      ...(signingReady ? { publisherName: config.publisherNames } : {})
    }
  };
}

module.exports = { parseUpdateConfig, desktopBuildConfig };
