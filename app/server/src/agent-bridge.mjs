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

export async function generateDragonReply(message, learnedWord) {
  const learnedWords = Array.isArray(learnedWord?.allLearnedWords)
    ? learnedWord.allLearnedWords
    : [];
  const userName = learnedWord?.profile?.userName || "unknown";
  const chineseName = learnedWord?.profile?.chineseName || "unknown";

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
    "If the user just gave their name and there is no Chinese name yet, give them a Chinese name based on pronunciation, explain each character's meaning in English, and say why it fits them.",
    "Support smart teaching mistakes as part of learning. For example, after learning 山 or after learning 大 and 小, you may intentionally point at a big 山 and say 好小, then let the user correct you.",
    "If the user corrects a confusion between 大 and 小, react cutely and clearly: admit you mixed them up, then restate that 大 means big and 小 means small in English-heavy wording.",
    "Do not make the whole interaction into a rigid quiz. Keep it playful and conversational.",
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
