const supportedMajor = 22;
const currentMajor = Number.parseInt(process.versions.node.split('.')[0], 10);

if (currentMajor !== supportedMajor) {
  // Non-blocking guard: keeps dev workflows running while making drift explicit.
  console.warn(
    `[node-version] Running Node ${process.versions.node}. Recommended for this project: Node ${supportedMajor}.x LTS.`
  );
}
