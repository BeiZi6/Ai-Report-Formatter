import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function resolveBinarySourcePath({ repoRoot, rustTarget, binaryName }) {
  const targetDir = rustTarget
    ? path.join(repoRoot, "apps", "rust-api", "target", rustTarget, "release")
    : path.join(repoRoot, "apps", "rust-api", "target", "release");
  return path.join(targetDir, binaryName);
}

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const webRoot = path.resolve(scriptDir, "..", "..");
const repoRoot = path.resolve(webRoot, "..", "..");
const manifestPath = path.join(repoRoot, "apps", "rust-api", "Cargo.toml");

const rustTarget = process.env.RUST_TARGET;
const rustBinaryName = process.platform === "win32" ? "rust-api.exe" : "rust-api";
const bundledBinaryName = process.platform === "win32" ? "api-server.exe" : "api-server";

const cargoArgs = ["build", "--release", "--manifest-path", manifestPath];
if (rustTarget) {
  cargoArgs.push("--target", rustTarget);
}

const build = spawnSync("cargo", cargoArgs, {
  cwd: repoRoot,
  stdio: "inherit",
});

if (build.error) {
  if (build.error.code === "ENOENT") {
    fail("Cargo not found. Install Rust toolchain and retry.");
  }
  fail(`Failed to run cargo: ${build.error.message}`);
}

if ((build.status ?? 1) !== 0) {
  process.exit(build.status ?? 1);
}

const sourceBinaryPath = resolveBinarySourcePath({
  repoRoot,
  rustTarget,
  binaryName: rustBinaryName,
});

if (!existsSync(sourceBinaryPath)) {
  fail(`Expected Rust backend binary not found at ${sourceBinaryPath}`);
}

const destinationDir = path.join(webRoot, "electron", "backend");
mkdirSync(destinationDir, { recursive: true });
const destinationPath = path.join(destinationDir, bundledBinaryName);

copyFileSync(sourceBinaryPath, destinationPath);
if (process.platform !== "win32") {
  chmodSync(destinationPath, 0o755);
}

console.log(`Bundled Rust backend copied to: ${destinationPath}`);
