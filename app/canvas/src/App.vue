<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import mountainArt from "../../../assets/dragon/山.png";
import waterArt from "../../../assets/dragon/水.png";
import sunArt from "../../../assets/dragon/日.png";
import DragonDialogueHud from "./components/DragonDialogueHud.vue";
import DragonQuizCard from "./components/DragonQuizCard.vue";
import {
  fetchBootstrap,
  moveSceneObject,
  resetDragonState,
  resolveServerAsset,
  sendChatMessage,
  teachPhotoWord,
  toggleSleepMode,
  submitQuizAnswer,
} from "./services/api";

const dragonFrameModules = import.meta.glob("../../../assets/dragon_action1/*.png", {
  eager: true,
  import: "default",
});
const dragonFrames = Object.entries(dragonFrameModules)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([, value]) => value);

const bootstrapState = ref({
  messages: [],
  learnedWords: [],
  scene: {
    objects: [],
    weather: "clear",
    location: "ink-lake",
    dragonMood: "curious",
  },
  quiz: null,
});

const draft = ref("");
const inputActive = ref(false);
const sending = ref(false);
const quizSubmitting = ref(false);
const resetting = ref(false);
const loading = ref(true);
const errorMessage = ref("");
const selectedWord = ref("");
const photoWordDraft = ref("");
const uploadInputRef = ref(null);
const uploadingPhoto = ref(false);
const pendingPhoto = ref(null);
const worldShellRef = ref(null);
const sleepingToggleBusy = ref(false);
const dragState = ref(null);
const dragJustEnded = ref(false);
const sleepLetterVisible = ref(false);
const dragonFrameIndex = ref(0);
let dragonAnimationTimer = null;
const sceneArtMap = {
  山: mountainArt,
  水: waterArt,
  日: sunArt,
};

const sceneObjects = computed(() => bootstrapState.value.scene?.objects || []);
const learnedCount = computed(() => bootstrapState.value.learnedWords?.length || 0);
const dragonMood = computed(() => bootstrapState.value.scene?.dragonMood || "curious");
const isSleeping = computed(() => Boolean(bootstrapState.value.scene?.isSleeping));
const sleepLetter = computed(() => bootstrapState.value.sleepLetter || null);
const currentDragonFrame = computed(
  () => dragonFrames[dragonFrameIndex.value % Math.max(dragonFrames.length, 1)] || "",
);
const activeQuiz = computed(
  () => bootstrapState.value.quiz?.status === "active" ? bootstrapState.value.quiz : null,
);
const latestDragonMessage = computed(() => {
  const messages = bootstrapState.value.messages || [];
  const mostRecentMessage = messages[messages.length - 1];
  if (!mostRecentMessage || mostRecentMessage.role !== "assistant") {
    return null;
  }
  return mostRecentMessage;
});

function splitBubbleParts(text) {
  const message = String(text || "");
  const shouldHighlightQuestion =
    /\bwhat\s+is\s+your\s+name\b/i.test(message) ||
    /\bwhat\s+is\s+this\b/i.test(message) ||
    /\bwill\s+you\b/i.test(message) ||
    /\bteach\s+me\b/i.test(message);

  if (!shouldHighlightQuestion) {
    return [{ text: message, emphasized: false }];
  }

  const match = message.match(/^(.+?\?)(\s*)([\s\S]*)$/);
  if (!match) {
    return [{ text: message, emphasized: true }];
  }

  const [, prompt, spacer, remainder] = match;
  return [
    { text: prompt, emphasized: true },
    ...(spacer ? [{ text: spacer, emphasized: false }] : []),
    ...(remainder ? [{ text: remainder, emphasized: false }] : []),
  ];
}

async function loadBootstrap() {
  loading.value = true;
  errorMessage.value = "";
  try {
    bootstrapState.value = await fetchBootstrap();
    selectedWord.value = "";
    sleepLetterVisible.value = Boolean(bootstrapState.value.sleepLetter);
  } catch (error) {
    errorMessage.value = "The local dragon server is not connected yet.";
  } finally {
    loading.value = false;
  }
}

async function handleSend() {
  const message = draft.value.trim();
  if (!message || sending.value) {
    return;
  }

  sending.value = true;
  errorMessage.value = "";
  try {
    bootstrapState.value = await sendChatMessage(message);
    draft.value = "";
    selectedWord.value = "";
    sleepLetterVisible.value = false;
  } catch (error) {
    errorMessage.value = "The dragon could not hear that message.";
  } finally {
    sending.value = false;
  }
}

async function handleQuizAnswer(choice) {
  if (!choice || quizSubmitting.value) {
    return;
  }

  quizSubmitting.value = true;
  errorMessage.value = "";
  try {
    bootstrapState.value = await submitQuizAnswer(choice);
    selectedWord.value = choice;
    sleepLetterVisible.value = false;
  } catch (error) {
    errorMessage.value = "The dragon lost track of the quiz for a moment.";
  } finally {
    quizSubmitting.value = false;
  }
}

function handleSceneObjectClick(object) {
  if (dragJustEnded.value) {
    return;
  }

  selectedWord.value = object.word;
  inputActive.value = true;

  if (activeQuiz.value && activeQuiz.value.choices.includes(object.word)) {
    handleQuizAnswer(object.word);
    return;
  }

  draft.value = object.word;
}

function resolveSceneArt(word) {
  return sceneArtMap[word] || "";
}

function resolveSceneObjectAsset(object) {
  if (object.imagePath) {
    return resolveServerAsset(object.imagePath);
  }
  return resolveSceneArt(object.word);
}

function triggerPhotoPicker() {
  uploadInputRef.value?.click();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.readAsDataURL(file);
  });
}

async function handlePhotoSelected(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  errorMessage.value = "";
  try {
    const imageDataUrl = await fileToDataUrl(file);
    pendingPhoto.value = {
      fileName: file.name,
      imageDataUrl,
      previewUrl: imageDataUrl,
    };
    photoWordDraft.value = "";
  } catch (error) {
    errorMessage.value = "The photo could not be opened.";
  } finally {
    event.target.value = "";
  }
}

function closePhotoPrompt() {
  pendingPhoto.value = null;
  photoWordDraft.value = "";
}

async function handleTeachPhoto() {
  const word = photoWordDraft.value.trim();
  if (!pendingPhoto.value || !word || uploadingPhoto.value) {
    return;
  }

  uploadingPhoto.value = true;
  errorMessage.value = "";
  try {
    bootstrapState.value = await teachPhotoWord({
      word,
      imageDataUrl: pendingPhoto.value.imageDataUrl,
      fileName: pendingPhoto.value.fileName,
    });
    selectedWord.value = word;
    sleepLetterVisible.value = false;
    closePhotoPrompt();
  } catch (error) {
    errorMessage.value = "The dragon could not remember that photo yet.";
  } finally {
    uploadingPhoto.value = false;
  }
}

async function handleReset() {
  if (resetting.value) {
    return;
  }

  resetting.value = true;
  errorMessage.value = "";
  try {
    bootstrapState.value = await resetDragonState();
    draft.value = "";
    selectedWord.value = "";
    inputActive.value = false;
    sleepLetterVisible.value = false;
  } catch (error) {
    errorMessage.value = "The dragon could not clear the painting.";
  } finally {
    resetting.value = false;
  }
}

async function handleSleepToggle() {
  if (sleepingToggleBusy.value) {
    return;
  }

  sleepingToggleBusy.value = true;
  errorMessage.value = "";
  try {
    bootstrapState.value = await toggleSleepMode();
    sleepLetterVisible.value = Boolean(bootstrapState.value.sleepLetter);
  } catch (error) {
    errorMessage.value = "The dragon could not settle down to sleep.";
  } finally {
    sleepingToggleBusy.value = false;
  }
}

async function handleSleepMaskClick() {
  sleepLetterVisible.value = false;
  if (!isSleeping.value || sleepingToggleBusy.value) {
    return;
  }
  await handleSleepToggle();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function updateDraggedObject(clientX, clientY) {
  if (!dragState.value || !worldShellRef.value) {
    return;
  }

  const rect = worldShellRef.value.getBoundingClientRect();
  const xPercent = clamp(((clientX - rect.left) / rect.width) * 100, 8, 92);
  const yPercent = clamp(((clientY - rect.top) / rect.height) * 100, 18, 82);

  bootstrapState.value = {
    ...bootstrapState.value,
    scene: {
      ...bootstrapState.value.scene,
      objects: bootstrapState.value.scene.objects.map((object) =>
        object.id === dragState.value.objectId
          ? {
              ...object,
              x: `${xPercent}%`,
              y: `${yPercent}%`,
            }
          : object,
      ),
    },
  };
}

function handleSceneObjectPointerDown(event, object) {
  if (event.button !== 0) {
    return;
  }
  event.preventDefault();

  dragState.value = {
    objectId: object.id,
    moved: false,
  };

  const startX = event.clientX;
  const startY = event.clientY;

  function moveHandler(moveEvent) {
    if (!dragState.value) {
      return;
    }
    const distance = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
    if (distance > 4) {
      dragState.value.moved = true;
    }
    updateDraggedObject(moveEvent.clientX, moveEvent.clientY);
  }

  window.addEventListener("pointermove", moveHandler);
  window.addEventListener("pointerup", onGlobalPointerUp, { once: true });

  handleSceneObjectPointerDown.moveHandler = moveHandler;
}

async function onGlobalPointerUp() {
  const moveHandler = handleSceneObjectPointerDown.moveHandler;
  if (moveHandler) {
    window.removeEventListener("pointermove", moveHandler);
    handleSceneObjectPointerDown.moveHandler = null;
  }

  if (!dragState.value) {
    return;
  }

  const object = bootstrapState.value.scene.objects.find(
    (entry) => entry.id === dragState.value.objectId,
  );
  const moved = dragState.value.moved;
  dragState.value = null;
  if (moved) {
    dragJustEnded.value = true;
    window.setTimeout(() => {
      dragJustEnded.value = false;
    }, 120);
  }

  if (!object || !moved) {
    return;
  }

  try {
    bootstrapState.value = await moveSceneObject({
      objectId: object.id,
      x: object.x,
      y: object.y,
    });
  } catch (error) {
    errorMessage.value = "The painting could not keep that new position.";
  }
}

onMounted(() => {
  loadBootstrap();
  dragonAnimationTimer = window.setInterval(() => {
    dragonFrameIndex.value = (dragonFrameIndex.value + 1) % Math.max(dragonFrames.length, 1);
  }, 70);
});

onUnmounted(() => {
  if (dragonAnimationTimer) {
    window.clearInterval(dragonAnimationTimer);
    dragonAnimationTimer = null;
  }
});
</script>

<template>
  <main class="app-shell">
    <section ref="worldShellRef" class="world-shell" :class="{ 'world-shell-sleeping': isSleeping }">
      <div class="mist-layer"></div>
      <div class="ink-glow ink-glow-left"></div>
      <div class="ink-glow ink-glow-right"></div>
      <div class="sun-haze"></div>
      <div class="moon-disc"></div>
      <div v-if="isSleeping" class="sleep-overlay" aria-hidden="true"></div>

      <div class="mountain-band mountain-band-far" aria-hidden="true">
        <span class="mountain peak-a"></span>
        <span class="mountain peak-b"></span>
        <span class="mountain peak-c"></span>
      </div>

      <div class="mountain-band mountain-band-mid" aria-hidden="true">
        <span class="mountain peak-d"></span>
        <span class="mountain peak-e"></span>
        <span class="mountain peak-f"></span>
      </div>

      <div class="lake-band" aria-hidden="true"></div>
      <div class="shoreline" aria-hidden="true"></div>

      <div class="reed-cluster reed-cluster-left" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>

      <div class="reed-cluster reed-cluster-right" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>

      <section class="scene-status-bar">
        <article class="status-chip">
          <span class="status-label">Words</span>
          <strong>{{ loading ? "..." : learnedCount }}</strong>
        </article>
        <article class="status-chip">
          <span class="status-label">Mood</span>
          <strong>{{ dragonMood }}</strong>
        </article>
        <button
          type="button"
          class="status-reset"
          :disabled="resetting"
          @click="handleReset"
        >
          {{ resetting ? "Clearing..." : "Clear Memory" }}
        </button>
        <button
          type="button"
          class="status-upload"
          :disabled="uploadingPhoto"
          @click="triggerPhotoPicker"
        >
          {{ uploadingPhoto ? "Saving..." : "Teach With Photo" }}
        </button>
        <button
          type="button"
          class="status-sleep"
          :disabled="sleepingToggleBusy"
          @click="handleSleepToggle"
        >
          {{ sleepingToggleBusy ? "..." : isSleeping ? "Wake Up" : "Sleep" }}
        </button>
      </section>

      <figure class="dragon-stage" :class="`dragon-stage-${dragonMood}`">
        <div class="dragon-stage-orb">
          <aside
            v-if="latestDragonMessage && !sleepLetterVisible"
            class="dragon-speech-bubble"
            aria-label="Longado speech bubble"
          >
            <p class="dragon-speech-speaker">Longado</p>
            <p class="dragon-speech-text">
              <template
                v-for="(part, partIndex) in splitBubbleParts(latestDragonMessage.text)"
                :key="`${latestDragonMessage.id || latestDragonMessage.createdAt}-bubble-${partIndex}`"
              >
                <span :class="part.emphasized ? 'dragon-speech-emphasis' : 'dragon-speech-plain'">
                  {{ part.text }}
                </span>
              </template>
            </p>
          </aside>
          <img
            :src="currentDragonFrame"
            alt="Longado animation"
            class="dragon-stage-image"
          />
        </div>
        <figcaption class="dragon-stage-copy">
          <p class="dragon-stage-name">Longado</p>
          <p class="dragon-stage-note">Teach one word. Click a word in the scene to reuse it.</p>
        </figcaption>
      </figure>

      <section
        v-if="sceneObjects.length"
        class="scene-word-layer"
        aria-label="Learned words in the painting"
      >
        <button
          v-for="object in sceneObjects"
          :key="object.id"
          type="button"
          class="scene-word-object"
          :class="{
            'scene-word-object-selected': selectedWord === object.word,
            'scene-word-object-dragging': dragState?.objectId === object.id,
          }"
          :style="{ left: object.x, top: object.y }"
          @pointerdown="handleSceneObjectPointerDown($event, object)"
          @click="handleSceneObjectClick(object)"
        >
          <img
            v-if="resolveSceneObjectAsset(object)"
            :src="resolveSceneObjectAsset(object)"
            :alt="object.word"
            class="scene-word-art"
          />
          <span v-else class="scene-word-token">{{ object.word }}</span>
          <span class="scene-word-label">{{ object.word }}</span>
        </button>
      </section>

      <p v-if="errorMessage" class="world-error">{{ errorMessage }}</p>

      <div
        v-if="isSleeping"
        class="sleep-mask"
        aria-hidden="true"
        @click="handleSleepMaskClick"
      ></div>

      <section
        v-if="sleepLetter && sleepLetterVisible"
        class="sleep-showcase"
        aria-label="Dragon sleep letter"
        @click.stop
      >
        <aside class="sleep-intro-panel" aria-label="Awaken the Dragon introduction">
          <p class="sleep-intro-eyebrow">醒龙 · Awaken the Dragon</p>
          <h3 class="sleep-intro-title">醒龙</h3>
          <p class="sleep-intro-subtitle">Awaken the Dragon</p>
          <ul class="sleep-intro-list">
            <li>
              <span class="sleep-intro-cn">接入世界中文大会金牌工具WordFlow</span>
              <span class="sleep-intro-en">Powered by WordFlow, a gold-winning tool from the World Chinese Language Conference.</span>
            </li>
            <li>
              <span class="sleep-intro-cn">11,092条HSK词汇链数据库</span>
              <span class="sleep-intro-en">Built on a database of 11,092 HSK vocabulary-chain entries.</span>
            </li>
            <li>
              <span class="sleep-intro-cn">会3，500+全球教师培训经验</span>
              <span class="sleep-intro-en">Shaped by 3,500+ global teacher-training experiences.</span>
            </li>
            <li>
              <span class="sleep-intro-cn">基于openclaw构建</span>
              <span class="sleep-intro-en">Constructed on top of openclaw.</span>
            </li>
            <li>
              <span class="sleep-intro-cn">WordFlow x TeachFlow</span>
              <span class="sleep-intro-en">WordFlow x TeachFlow.</span>
            </li>
            <li>
              <span class="sleep-intro-cn">养一条龙，学一种语言，看见一个世界</span>
              <span class="sleep-intro-en">Raise a dragon, learn a language, and see a world.</span>
            </li>
          </ul>
        </aside>

        <aside class="sleep-letter-shell">
          <div class="sleep-letter-envelope"></div>
          <article class="sleep-letter-card">
            <p class="sleep-letter-eyebrow">Night Letter</p>
            <h3 class="sleep-letter-title">{{ sleepLetter.title }}</h3>
            <p class="sleep-letter-body">{{ sleepLetter.body }}</p>
          </article>
        </aside>
      </section>

      <input
        ref="uploadInputRef"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        class="visually-hidden"
        @change="handlePhotoSelected"
      />

      <aside v-if="pendingPhoto" class="photo-teach-card" aria-label="Teach a photo word">
        <p class="photo-teach-eyebrow">Photo Lesson</p>
        <p class="photo-teach-prompt">Longado looks at the photo. "What is this?"</p>
        <img :src="pendingPhoto.previewUrl" alt="Uploaded preview" class="photo-teach-preview" />
        <label class="photo-teach-label" for="photo-word-input">Teach the word</label>
        <input
          id="photo-word-input"
          v-model="photoWordDraft"
          type="text"
          class="photo-teach-input"
          placeholder="Type the word here..."
        />
        <div class="photo-teach-actions">
          <button type="button" class="photo-teach-secondary" @click="closePhotoPrompt">
            Cancel
          </button>
          <button
            type="button"
            class="photo-teach-primary"
            :disabled="uploadingPhoto || !photoWordDraft.trim()"
            @click="handleTeachPhoto"
          >
            {{ uploadingPhoto ? "Remembering..." : "Teach This Word" }}
          </button>
        </div>
      </aside>

      <DragonDialogueHud
        :messages="bootstrapState.messages"
        :draft="draft"
        :is-active="inputActive"
        :is-sending="sending"
        @activate="inputActive = true"
        @deactivate="inputActive = false"
        @update:draft="draft = $event"
        @send="handleSend"
      />

      <DragonQuizCard
        :quiz="bootstrapState.quiz"
        :art-map="sceneArtMap"
        :submitting="quizSubmitting"
        @answer="handleQuizAnswer"
      />
    </section>
  </main>
</template>
