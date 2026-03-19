import { execFile } from "node:child_process";

function runOpenClaw(message) {
  const sessionId = `awakendragon-bridge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return new Promise((resolve, reject) => {
    execFile(
      "openclaw",
      [
        "agent",
        "--agent",
        "awakendragon",
        "--session-id",
        sessionId,
        "--message",
        message,
        "--json",
        "--timeout",
        "60",
      ],
      { maxBuffer: 1024 * 1024 * 8 },
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({
          stdout: stdout || "",
          stderr: stderr || "",
        });
      },
    );
  });
}

function parseJsonPayload(stdout, stderr) {
  const rawOutput = stdout || stderr || "";
  const firstBrace = rawOutput.indexOf("{");
  if (firstBrace === -1) {
    throw new Error("No JSON payload found in OpenClaw output.");
  }
  return JSON.parse(rawOutput.slice(firstBrace));
}

function fallbackReply(message, learnedWord) {
  const learnedText =
    typeof learnedWord === "string" ? learnedWord : learnedWord?.word;

  if (learnedText) {
    return `I learned ${learnedText}! I put it carefully into the painting. Did I remember it right?`;
  }

  return `I heard you. I am still a tiny dragon, so I may need a moment... but I am here.`;
}

function specialReply(context) {
  const newestWord =
    typeof context === "string" ? context : context?.word;
  const knownWords = Array.isArray(context?.allLearnedWords)
    ? context.allLearnedWords
    : [];
  const userName = context?.profile?.userName || "";

  if (newestWord !== "山" || !context?.isNewWord) {
    return "";
  }

  const nameLine = userName
    ? `I know your name now, ${userName}. That makes me happy.`
    : "What is your name? I want to remember it.";

  return [
    "山! shān... mountain, right?",
    "",
    "This word feels tall and quiet to me.",
    "Let me try: 这个山很太！...wait, 太? 大? They look so similar to me. Did I mix them up?",
    "",
    `I know ${knownWords.length} word${knownWords.length === 1 ? "" : "s"} now:`,
    ...knownWords.map((word) => `- ${word}`),
    "",
    nameLine,
  ].join("\n");
}

export async function generateDragonReply(message, learnedWord) {
  const learnedWords = Array.isArray(learnedWord?.allLearnedWords)
    ? learnedWord.allLearnedWords
    : [];
  const userName = learnedWord?.profile?.userName || "unknown";
  const chineseName = learnedWord?.profile?.chineseName || "unknown";
  const forcedReply = specialReply(learnedWord);
  if (forcedReply) {
    return {
      text: forcedReply,
      source: "special",
    };
  }

  const runtimeMessage = [
    "Runtime state override. Follow this state exactly.",
    `Known words: ${learnedWords.length ? learnedWords.join("、") : "none"}.`,
    `Known user name: ${userName}.`,
    `Known Chinese name: ${chineseName}.`,
    `Newest word from the user: ${
      typeof learnedWord === "string" ? learnedWord : learnedWord?.word || "none"
    }.`,
    "Do not claim to know any other words.",
    "Do not mention prior lessons outside this list.",
    "Use English for all narration, explanation, and questions.",
    "Only use Chinese for the Chinese word being learned or for very short Chinese example phrases.",
    "Do not use Chinese-style stage directions or Chinese-only emotional narration outside the learning phrase itself.",
    "If the user name is unknown, ask for the user's name in English at the end.",
    "Your fixed name is Longado.",
    "",
    `User message: ${message}`,
  ].join("\n");

  try {
    const { stdout, stderr } = await runOpenClaw(runtimeMessage);
    const payload = parseJsonPayload(stdout, stderr);
    const text = payload?.result?.payloads?.[0]?.text?.trim();

    if (!text || /rate limit/i.test(text)) {
      return {
        text: fallbackReply(message, learnedWord),
        source: "fallback",
      };
    }

    return {
      text,
      source: "openclaw",
    };
  } catch (error) {
    return {
      text: fallbackReply(message, learnedWord),
      source: "fallback",
      error: error.message,
    };
  }
}
