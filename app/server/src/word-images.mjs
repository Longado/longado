import fs from "node:fs";
import path from "node:path";
import { generatedWordsDir } from "./config.mjs";

function fileStemForWord(word) {
  return Buffer.from(word).toString("hex");
}

function paletteForWord(word) {
  const palettes = [
    { paper: "#f8f1de", ink: "#33413e", wash: "#9db1a5" },
    { paper: "#f5ead7", ink: "#4d5a54", wash: "#b8a18a" },
    { paper: "#f4efe5", ink: "#3c474f", wash: "#90a5aa" },
    { paper: "#f4eadc", ink: "#3f4a3f", wash: "#a8b996" },
  ];
  const hash = [...word].reduce((sum, char) => sum + char.codePointAt(0), 0);
  return palettes[hash % palettes.length];
}

export function ensureWordImage(word) {
  const stem = fileStemForWord(word);
  const fileName = `${stem}.svg`;
  const filePath = path.join(generatedWordsDir, fileName);

  if (!fs.existsSync(filePath)) {
    const { paper, ink, wash } = paletteForWord(word);
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="240" height="240" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="240" height="240" rx="36" fill="${paper}"/>
  <circle cx="54" cy="54" r="44" fill="${wash}" fill-opacity="0.22"/>
  <circle cx="188" cy="190" r="60" fill="${wash}" fill-opacity="0.16"/>
  <rect x="18" y="18" width="204" height="204" rx="28" stroke="${ink}" stroke-opacity="0.1" stroke-width="2"/>
  <text x="120" y="128" text-anchor="middle" fill="${ink}" font-size="102" font-family="KaiTi, STKaiti, serif">${word}</text>
  <text x="120" y="192" text-anchor="middle" fill="${ink}" fill-opacity="0.56" font-size="18" font-family="PingFang SC, Noto Sans SC, sans-serif">Awaken Dragon</text>
</svg>`;
    fs.writeFileSync(filePath, svg);
  }

  return {
    fileName,
    filePath,
    publicPath: `/generated/words/${fileName}`,
  };
}
