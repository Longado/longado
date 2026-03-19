const fallbackChoices = ["山", "水", "月", "花", "家", "雨", "雪"];

function chineseTokensFromText(text) {
  const matches = text.match(/[\u4e00-\u9fff]{1,4}/g) || [];
  return [...new Set(matches)];
}

export function extractLearnedWord(text) {
  const tokens = chineseTokensFromText(text);
  if (!tokens.length) {
    return null;
  }

  tokens.sort((a, b) => b.length - a.length);
  return tokens[0];
}

function nextSceneAnchor(index) {
  const anchors = [
    { x: "19%", y: "58%" },
    { x: "30%", y: "67%" },
    { x: "48%", y: "60%" },
    { x: "63%", y: "70%" },
    { x: "72%", y: "54%" },
    { x: "57%", y: "46%" },
  ];
  return anchors[index % anchors.length];
}

export function registerLearnedWord({ word, state, scene, imagePath = "" }) {
  const existing = state.learnedWords.find((entry) => entry.word === word);
  if (existing) {
    if (!imagePath || existing.imagePath === imagePath) {
      return {
        state,
        scene,
        learnedWord: existing,
        wasNew: false,
      };
    }

    const nextLearnedWords = state.learnedWords.map((entry) =>
      entry.word === word
        ? {
            ...entry,
            imagePath,
          }
        : entry,
    );
    const nextObjects = scene.objects.map((object) =>
      object.word === word
        ? {
            ...object,
            imagePath,
          }
        : object,
    );

    return {
      state: {
        ...state,
        learnedWords: nextLearnedWords,
      },
      scene: {
        ...scene,
        objects: nextObjects,
      },
      learnedWord: {
        ...existing,
        imagePath,
      },
      wasNew: false,
    };
  }

  const anchor = nextSceneAnchor(state.learnedWords.length);

  const learnedWord = {
    id: `word-${Date.now()}`,
    word,
    meaning: "",
    learnedAt: new Date().toISOString(),
    sourcePlace: scene.location,
    mastery: 0.35,
    imagePath,
  };

  const nextState = {
    ...state,
    learnedWords: [...state.learnedWords, learnedWord],
  };

  const nextScene = {
    ...scene,
    objects: [
      ...scene.objects,
      {
        id: `scene-${word}`,
        type: "word-text",
        word,
        imagePath,
        x: anchor.x,
        y: anchor.y,
      },
    ],
  };

  return {
    state: nextState,
    scene: nextScene,
    learnedWord,
    wasNew: true,
  };
}

export function buildQuiz(state, targetWord) {
  if (!targetWord) {
    return null;
  }

  const choices = [targetWord];
  const learnedPool = state.learnedWords
    .map((entry) => entry.word)
    .filter((word) => word !== targetWord);
  const fallbackPool = fallbackChoices.filter((word) => word !== targetWord);

  for (const word of [...learnedPool, ...fallbackPool]) {
    if (choices.includes(word)) {
      continue;
    }
    choices.push(word);
    if (choices.length === 3) {
      break;
    }
  }

  const target = state.learnedWords.find((entry) => entry.word === targetWord);
  return {
    id: `quiz-${Date.now()}`,
    prompt: "Longado points at something in the painting.",
    question: "What is this?",
    targetWord,
    targetLabel: target?.word || targetWord,
    choices: choices.sort(() => 0.5 - Math.random()),
    status: "active",
  };
}
