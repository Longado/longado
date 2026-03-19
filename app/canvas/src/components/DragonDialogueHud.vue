<script setup>
import { computed, nextTick, ref, watch } from "vue";

const props = defineProps({
  messages: {
    type: Array,
    default: () => [],
  },
  draft: {
    type: String,
    default: "",
  },
  isActive: {
    type: Boolean,
    default: false,
  },
  isSending: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["activate", "deactivate", "update:draft", "send"]);

const feedRef = ref(null);
const textareaRef = ref(null);
const sendButtonRef = ref(null);

function splitMessageParts(message) {
  const text = String(message?.text || "");
  const shouldHighlightQuestion =
    message?.role === "assistant" &&
    (/\bwhat\s+is\s+your\s+name\b/i.test(text) ||
      /\bwhat\s+is\s+this\b/i.test(text) ||
      /\bwill\s+you\b/i.test(text) ||
      /\bteach\s+me\b/i.test(text));

  if (!shouldHighlightQuestion) {
    return [{ text, emphasized: false }];
  }

  const match = text.match(/^(.+?\?)(\s*)([\s\S]*)$/);
  if (!match) {
    return [{ text, emphasized: true }];
  }

  const [, prompt, spacer, remainder] = match;
  return [
    { text: prompt, emphasized: true },
    ...(spacer ? [{ text: spacer, emphasized: false }] : []),
    ...(remainder ? [{ text: remainder, emphasized: false }] : []),
  ];
}

const decoratedMessages = computed(() =>
  props.messages.map((message, index, array) => {
    const fromEnd = array.length - index;
    let tone = "older";
    if (fromEnd <= 2) {
      tone = "fresh";
    } else if (fromEnd <= 5) {
      tone = "mid";
    }
    return {
      ...message,
      tone,
      roleTone: message.role === "user" ? "user" : "assistant",
      parts: splitMessageParts(message),
    };
  }),
);

function syncScrollToBottom() {
  nextTick(() => {
    if (!feedRef.value) {
      return;
    }
    feedRef.value.scrollTop = feedRef.value.scrollHeight;
  });
}

watch(
  () => props.messages.length,
  () => {
    syncScrollToBottom();
  },
  { immediate: true },
);

watch(
  () => props.isActive,
  (isActive) => {
    if (!isActive) {
      return;
    }
    nextTick(() => textareaRef.value?.focus());
  },
);

function onKeydown(event) {
  if (event.isComposing || event.keyCode === 229) {
    return;
  }

  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    emit("send");
  }
}

function onTextareaBlur(event) {
  if (event.relatedTarget === sendButtonRef.value) {
    return;
  }
  emit("deactivate");
}
</script>

<template>
  <section class="dialogue-hud" aria-label="Dragon dialogue HUD">
    <div class="dialogue-feed-shell">
      <div class="dialogue-feed-fade dialogue-feed-fade-top" aria-hidden="true"></div>

      <div ref="feedRef" class="dialogue-feed" aria-label="Message list">
        <article
          v-for="message in decoratedMessages"
          :key="message.id || message.createdAt"
          class="dialogue-line"
          :class="[`dialogue-line-${message.tone}`, `dialogue-line-${message.roleTone}`]"
        >
          <p class="dialogue-speaker">{{ message.speaker }}</p>
          <p class="dialogue-text">
            <template v-for="(part, partIndex) in message.parts" :key="`${message.id || message.createdAt}-${partIndex}`">
              <span
                :class="part.emphasized ? 'dialogue-text-emphasis' : 'dialogue-text-plain'"
              >
                {{ part.text }}
              </span>
            </template>
          </p>
        </article>
      </div>
    </div>

    <div class="dialogue-input-shell" aria-label="Dialogue input placeholder">
      <button
        v-if="!isActive"
        type="button"
        class="dialogue-input-bar dialogue-input-bar-idle"
        @click="$emit('activate')"
      >
        <span class="dialogue-input-placeholder">Click here to speak with Longado.</span>
      </button>

      <div v-else class="dialogue-input-active">
        <textarea
          ref="textareaRef"
          :value="draft"
          class="dialogue-input-textarea"
          rows="2"
          placeholder="Teach Longado a word..."
          @input="$emit('update:draft', $event.target.value)"
          @keydown="onKeydown"
          @blur="onTextareaBlur"
        ></textarea>

        <button
          ref="sendButtonRef"
          type="button"
          class="dialogue-send"
          :disabled="isSending || !draft.trim()"
          @click="$emit('send')"
        >
          {{ isSending ? "..." : "Send" }}
        </button>
      </div>
    </div>
  </section>
</template>
