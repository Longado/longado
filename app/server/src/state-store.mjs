import fs from "node:fs";
import {
  generatedWordsDir,
  memoryDir,
  sceneDir,
  sceneFile,
  stateFile,
  uploadsDir,
} from "./config.mjs";

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function defaultMessages() {
  return [
    {
      id: "seed-1",
      role: "assistant",
      speaker: "Longado",
      text: "I woke up in a painting... Is this 水墨? It feels soft and a little lonely.",
      createdAt: new Date().toISOString(),
    },
    {
      id: "seed-2",
      role: "assistant",
      speaker: "Longado",
      text: "What is your name? I want to remember the first human I met.",
      createdAt: new Date().toISOString(),
    },
  ];
}

function defaultScene() {
  return {
    objects: [],
    weather: "clear",
    location: "ink-lake",
    dragonMood: "curious",
    isSleeping: false,
  };
}

function defaultState() {
  return {
    messages: defaultMessages(),
    learnedWords: [],
    quiz: null,
    sleepLetter: null,
    profile: {
      userName: "",
      chineseName: "",
    },
    meta: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

export function ensureDataFiles() {
  ensureDir(memoryDir);
  ensureDir(sceneDir);
  ensureDir(generatedWordsDir);
  ensureDir(uploadsDir);

  if (!fs.existsSync(stateFile)) {
    fs.writeFileSync(stateFile, JSON.stringify(defaultState(), null, 2));
  }

  if (!fs.existsSync(sceneFile)) {
    fs.writeFileSync(sceneFile, JSON.stringify(defaultScene(), null, 2));
  }
}

export function readState() {
  ensureDataFiles();
  const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  return {
    profile: {
      userName: "",
      chineseName: "",
      ...(state.profile || {}),
    },
    ...state,
  };
}

export function writeState(nextState) {
  const merged = {
    ...nextState,
    meta: {
      ...(nextState.meta || {}),
      updatedAt: new Date().toISOString(),
    },
  };
  fs.writeFileSync(stateFile, JSON.stringify(merged, null, 2));
  return merged;
}

export function readScene() {
  ensureDataFiles();
  return JSON.parse(fs.readFileSync(sceneFile, "utf8"));
}

export function writeScene(nextScene) {
  fs.writeFileSync(sceneFile, JSON.stringify(nextScene, null, 2));
  return nextScene;
}
