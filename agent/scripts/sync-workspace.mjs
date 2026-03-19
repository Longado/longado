import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd(), "awakendragon");
const promptsDir = path.join(repoRoot, "agent", "prompts");
const targetDir = path.resolve("/Users/jianghao/.openclaw/workspace-awakendragon");

const fileMap = new Map([
  ["AGENTS.md", "AGENTS.md"],
  ["SOUL.md", "SOUL.md"],
  ["IDENTITY.md", "IDENTITY.md"],
  ["TOOLS.md", "TOOLS.md"],
  ["USER.md", "USER.md"],
  ["MEMORY.md", "MEMORY.md"],
  ["HEARTBEAT.md", "HEARTBEAT.md"],
  ["BOOTSTRAP.md", "BOOTSTRAP.md"],
]);

fs.mkdirSync(targetDir, { recursive: true });

for (const [sourceName, targetName] of fileMap.entries()) {
  const sourcePath = path.join(promptsDir, sourceName);
  const targetPath = path.join(targetDir, targetName);
  fs.copyFileSync(sourcePath, targetPath);
  console.log(`synced ${targetName}`);
}
