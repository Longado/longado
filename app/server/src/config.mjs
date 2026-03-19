import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const serverRoot = path.resolve(__dirname, "..");
export const projectRoot = path.resolve(serverRoot, "..", "..");
export const dataRoot = path.join(projectRoot, "data");
export const memoryDir = path.join(dataRoot, "memory");
export const sceneDir = path.join(dataRoot, "scene");
export const generatedDir = path.join(dataRoot, "generated");
export const generatedWordsDir = path.join(generatedDir, "words");
export const uploadsDir = path.join(dataRoot, "uploads");

export const stateFile = path.join(memoryDir, "session-state.json");
export const sceneFile = path.join(sceneDir, "world-scene.json");

export const dragonAssetsDir = path.join(projectRoot, "assets", "dragon");
export const port = Number(process.env.AWAKENDRAGON_SERVER_PORT || 4310);
