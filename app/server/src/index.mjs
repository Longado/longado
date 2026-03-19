import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { dragonAssetsDir, generatedDir, port, uploadsDir } from "./config.mjs";
import { generateDragonReply } from "./agent-bridge.mjs";
import { extractLearnedWord, registerLearnedWord } from "./learning.mjs";
import { ensureDataFiles, readScene, readState, writeScene, writeState } from "./state-store.mjs";

ensureDataFiles();

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

function sendFile(req, res, filePath) {
  if (!fs.existsSync(filePath)) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  const ext = path.extname(filePath);
  const contentType =
    ext === ".svg"
      ? "image/svg+xml"
      : ext === ".png"
        ? "image/png"
        : "application/octet-stream";

  res.writeHead(200, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  fs.createReadStream(filePath).pipe(res);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024 * 10) {
        reject(new Error("Request body too large."));
      }
    });
    req.on("end", () => {
      resolve(body ? JSON.parse(body) : {});
    });
    req.on("error", reject);
  });
}

function extensionFromMime(mimeType) {
  if (mimeType === "image/png") {
    return "png";
  }
  if (mimeType === "image/jpeg") {
    return "jpg";
  }
  if (mimeType === "image/webp") {
    return "webp";
  }
  return "";
}

function savePhotoDataUrl(imageDataUrl, originalName = "") {
  const match = String(imageDataUrl || "").match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid image payload.");
  }

  const mimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  const extFromMime = extensionFromMime(mimeType);
  const extFromName = path.extname(originalName || "").replace(/^\./, "").toLowerCase();
  const ext = extFromMime || extFromName || "png";
  const fileName = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const absolutePath = path.join(uploadsDir, fileName);
  fs.writeFileSync(absolutePath, buffer);
  return {
    absolutePath,
    publicPath: `/uploads/${fileName}`,
  };
}

function buildBootstrapPayload() {
  const state = readState();
  const scene = readScene();
  return {
    messages: state.messages,
    learnedWords: state.learnedWords,
    scene,
    quiz: state.quiz,
    sleepLetter: state.sleepLetter,
    dragon: {
      mood: scene.dragonMood,
      portraitPath: "/assets/dragon/%E9%BE%9910.png",
    },
  };
}

function buildResetPayload() {
  const now = new Date().toISOString();
  const state = {
    messages: [
      {
        id: "seed-1",
        role: "assistant",
        speaker: "Longado",
        text: "I woke up in a painting... Is this 水墨? It feels soft and a little lonely.",
        createdAt: now,
      },
      {
        id: "seed-2",
        role: "assistant",
        speaker: "Longado",
        text: "What is your name? I want to remember the first human I met.",
        createdAt: now,
      },
    ],
    learnedWords: [],
    quiz: null,
    sleepLetter: null,
    profile: {
      userName: "",
      chineseName: "",
    },
    meta: {
      createdAt: now,
      updatedAt: now,
    },
  };

  const scene = {
    objects: [],
    weather: "clear",
    location: "ink-lake",
    dragonMood: "curious",
    isSleeping: false,
  };

  return { state, scene };
}

function buildSleepLetter(state) {
  const todayKey = new Date().toDateString();
  const todayWords = (state.learnedWords || []).filter((entry) => {
    if (!entry.learnedAt) {
      return false;
    }
    return new Date(entry.learnedAt).toDateString() === todayKey;
  });
  const words = todayWords.map((entry) => entry.word);
  const dragonName = "Longado";

  if (!words.length) {
    return {
      id: `sleep-letter-${Date.now()}`,
      title: `A note from ${dragonName}`,
      body: [
        `Dear friend,`,
        ``,
        `I am sleepy now. Today I mostly listened to the wind in the painting.`,
        `I did not learn a new Chinese word today, but I still want to rest beside you.`,
        `Tomorrow I will try to learn something small and bright.`,
        ``,
        `Good night,`,
        `${dragonName}`,
      ].join("\n"),
      words: [],
      createdAt: new Date().toISOString(),
    };
  }

  const joined = words.join("、");
  const body = [
    `Dear friend,`,
    ``,
    `I am getting sleepy, so I wanted to leave you a small letter.`,
    `Today I learned ${words.length} little word${words.length === 1 ? "" : "s"}: ${joined}.`,
    `They are still glowing in my head. ${words.map((word) => `${word}`).join(", ")} feel like tiny lights inside the painting.`,
    `I want to dream about ${words[0]} tonight, and maybe whisper ${words[words.length - 1]} before I sleep.`,
    ``,
    `Good night,`,
    `${dragonName}`,
  ].join("\n");

  return {
    id: `sleep-letter-${Date.now()}`,
      title: `A note from ${dragonName}`,
    body,
    words,
    createdAt: new Date().toISOString(),
  };
}

function extractUserName(text) {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return "";
  }

  const directMatch = normalized.match(/(?:my name is|i am|i'm|call me)\s+([A-Za-z][A-Za-z '\-]{0,30})/i);
  if (directMatch) {
    return directMatch[1].trim();
  }

  if (
    /[A-Za-z]/.test(normalized) &&
    !/[\u4e00-\u9fff]/.test(normalized) &&
    normalized.split(/\s+/).length <= 3 &&
    normalized.length <= 32
  ) {
    return normalized;
  }

  return "";
}

function extractChineseName(text) {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return "";
  }

  const englishPattern = normalized.match(/(?:chinese name is|my chinese name is)\s*([\u4e00-\u9fff]{1,4})/i);
  if (englishPattern) {
    return englishPattern[1];
  }

  const chinesePattern = normalized.match(/(?:中文名是|我的中文名字是)\s*([\u4e00-\u9fff]{1,4})/);
  if (chinesePattern) {
    return chinesePattern[1];
  }

  return "";
}

async function handleChat(req, res) {
  const body = await readBody(req);
  const message = String(body.message || "").trim();

  if (!message) {
    sendJson(res, 400, { error: "message is required" });
    return;
  }

  let state = readState();
  let scene = readScene();
  const now = new Date().toISOString();
  state.profile = {
    userName: "",
    chineseName: "",
    ...(state.profile || {}),
  };

  state.messages = [
    ...state.messages,
    {
      id: `user-${Date.now()}`,
      role: "user",
      speaker: "You",
      text: message,
      createdAt: now,
    },
  ];

  const learnedCandidate = extractLearnedWord(message);
  const userNameCandidate = extractUserName(message);
  const chineseNameCandidate = extractChineseName(message);

  if (!learnedCandidate && userNameCandidate && !state.profile.userName) {
    state.profile.userName = userNameCandidate;
  }

  if (chineseNameCandidate && !state.profile.chineseName) {
    state.profile.chineseName = chineseNameCandidate;
  }

  let learnedWord = null;
  let wasNewWord = false;

  if (learnedCandidate) {
    const result = registerLearnedWord({
      word: learnedCandidate,
      state,
      scene,
    });
    state = result.state;
    scene = result.scene;
    learnedWord = result.learnedWord;
    wasNewWord = result.wasNew;
  }

  const reply = await generateDragonReply(message, {
    ...(learnedWord || {}),
    allLearnedWords: state.learnedWords.map((entry) => entry.word),
    isNewWord: wasNewWord,
    profile: state.profile,
  });
  state.messages = [
    ...state.messages,
    {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      speaker: "Longado",
      text: reply.text,
      createdAt: new Date().toISOString(),
      source: reply.source,
    },
  ].slice(-40);

  if (wasNewWord && learnedWord) {
    state.quiz = null;
    scene.dragonMood = "excited";
  } else if (!state.quiz) {
    scene.dragonMood = "curious";
  }
  scene.isSleeping = false;
  state.sleepLetter = null;

  writeScene(scene);
  writeState(state);
  sendJson(res, 200, buildBootstrapPayload());
}

async function handleTeachPhoto(req, res) {
  const body = await readBody(req);
  const word = String(body.word || "").trim();
  const imageDataUrl = String(body.imageDataUrl || "").trim();
  const fileName = String(body.fileName || "").trim();

  if (!word) {
    sendJson(res, 400, { error: "word is required" });
    return;
  }

  if (!imageDataUrl) {
    sendJson(res, 400, { error: "imageDataUrl is required" });
    return;
  }

  let state = readState();
  let scene = readScene();

  const savedPhoto = savePhotoDataUrl(imageDataUrl, fileName);
  const result = registerLearnedWord({
    word,
    state,
    scene,
    imagePath: savedPhoto.publicPath,
  });
  state = result.state;
  scene = result.scene;

  state.messages = [
    ...state.messages,
    {
      id: `photo-user-${Date.now()}`,
      role: "user",
      speaker: "You",
      text: `[photo] ${word}`,
      createdAt: new Date().toISOString(),
      source: "photo-upload",
    },
    {
      id: `photo-assistant-${Date.now()}`,
      role: "assistant",
      speaker: "Longado",
      text: `Oh! This is ${word}? I will remember this picture with the word ${word}.`,
      createdAt: new Date().toISOString(),
      source: "photo-upload",
    },
  ].slice(-40);

  scene.dragonMood = "excited";
  state.quiz = null;
  scene.isSleeping = false;
  state.sleepLetter = null;

  writeScene(scene);
  writeState(state);
  sendJson(res, 200, buildBootstrapPayload());
}

async function handleMoveSceneObject(req, res) {
  const body = await readBody(req);
  const objectId = String(body.objectId || "").trim();
  const x = String(body.x || "").trim();
  const y = String(body.y || "").trim();

  if (!objectId || !x || !y) {
    sendJson(res, 400, { error: "objectId, x, y are required" });
    return;
  }

  const scene = readScene();
  scene.objects = scene.objects.map((object) =>
    object.id === objectId
      ? {
          ...object,
          x,
          y,
        }
      : object,
  );
  writeScene(scene);
  sendJson(res, 200, buildBootstrapPayload());
}

function handleSleepToggle(res) {
  const state = readState();
  const scene = readScene();
  const nextSleeping = !scene.isSleeping;

  scene.isSleeping = nextSleeping;
  scene.dragonMood = nextSleeping ? "sleepy" : "curious";
  state.sleepLetter = nextSleeping ? buildSleepLetter(state) : null;

  writeScene(scene);
  writeState(state);
  sendJson(res, 200, buildBootstrapPayload());
}

async function handleQuizAnswer(req, res) {
  const body = await readBody(req);
  const answer = String(body.answer || "").trim();
  const state = readState();
  const scene = readScene();
  const quiz = state.quiz;

  if (!quiz || quiz.status !== "active") {
    sendJson(res, 400, { error: "No active quiz." });
    return;
  }

  const correct = answer === quiz.targetWord;
  state.messages = [
    ...state.messages,
    {
      id: `quiz-${Date.now()}`,
      role: "assistant",
      speaker: "Longado",
      text: correct
        ? `！！！对了！是 ${quiz.targetWord}！（开心地蹦了一下）`
        : `（挠头）不是 ${answer}... 是 ${quiz.targetWord}。我再记一次。`,
      createdAt: new Date().toISOString(),
      source: "quiz",
    },
  ].slice(-40);

  const learnedWord = state.learnedWords.find((entry) => entry.word === quiz.targetWord);
  if (learnedWord) {
    learnedWord.mastery = Math.max(
      0.1,
      Math.min(1, learnedWord.mastery + (correct ? 0.25 : 0.08)),
    );
  }

  state.quiz = {
    ...quiz,
    status: "answered",
    answer,
    correct,
  };
  scene.dragonMood = correct ? "proud" : "thoughtful";

  writeScene(scene);
  writeState(state);
  sendJson(res, 200, buildBootstrapPayload());
}

function handleReset(res) {
  const { state, scene } = buildResetPayload();
  writeScene(scene);
  writeState(state);
  sendJson(res, 200, buildBootstrapPayload());
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/bootstrap") {
      sendJson(res, 200, buildBootstrapPayload());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/chat") {
      await handleChat(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/teach-photo") {
      await handleTeachPhoto(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/scene/object-move") {
      await handleMoveSceneObject(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/sleep-toggle") {
      handleSleepToggle(res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/reset") {
      handleReset(res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/quiz/answer") {
      await handleQuizAnswer(req, res);
      return;
    }

    if ((req.method === "GET" || req.method === "HEAD") && url.pathname.startsWith("/assets/dragon/")) {
      const fileName = decodeURIComponent(path.basename(url.pathname));
      sendFile(req, res, path.join(dragonAssetsDir, fileName));
      return;
    }

    if ((req.method === "GET" || req.method === "HEAD") && url.pathname.startsWith("/generated/")) {
      const filePath = path.join(generatedDir, url.pathname.replace("/generated/", ""));
      sendFile(req, res, filePath);
      return;
    }

    if ((req.method === "GET" || req.method === "HEAD") && url.pathname.startsWith("/uploads/")) {
      const fileName = path.basename(url.pathname);
      sendFile(req, res, path.join(uploadsDir, fileName));
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 500, {
      error: "Server error",
      detail: error.message,
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Awaken Dragon server listening on http://127.0.0.1:${port}`);
});
