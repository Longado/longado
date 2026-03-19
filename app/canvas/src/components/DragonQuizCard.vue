<template>
  <aside
    v-if="quiz"
    class="quiz-card"
    :class="{ 'quiz-card-answered': quiz.status === 'answered' }"
    aria-label="Dragon quiz card"
  >
    <p class="quiz-eyebrow">Dragon Quiz</p>
    <p class="quiz-prompt">{{ quiz.prompt }}</p>

    <div class="quiz-word-shell">
      <img
        v-if="quizArt"
        :src="quizArt"
        :alt="quiz.targetWord"
        class="quiz-word-art"
      />
      <span v-else class="quiz-word-token">{{ quiz.targetLabel || quiz.targetWord }}</span>
    </div>

    <h3 class="quiz-question">{{ quiz.question }}</h3>

    <div class="quiz-choices">
      <button
        v-for="choice in quiz.choices"
        :key="choice"
        type="button"
        class="quiz-choice"
        :class="choiceClass(choice)"
        :disabled="isLocked"
        @click="$emit('answer', choice)"
      >
        {{ choice }}
      </button>
    </div>

    <p v-if="quiz.status === 'answered'" class="quiz-result">
      {{ quiz.correct ? "Longado remembered it!" : `The right answer was ${quiz.targetWord}.` }}
    </p>
  </aside>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  quiz: {
    type: Object,
    default: null,
  },
  artMap: {
    type: Object,
    default: () => ({}),
  },
  submitting: {
    type: Boolean,
    default: false,
  },
});

defineEmits(["answer"]);

const isLocked = computed(
  () => props.submitting || props.quiz?.status === "answered",
);

const quizArt = computed(() => props.artMap?.[props.quiz?.targetWord] || "");

function choiceClass(choice) {
  if (props.quiz?.status !== "answered") {
    return "";
  }
  if (choice === props.quiz.targetWord) {
    return "quiz-choice-correct";
  }
  if (choice === props.quiz.answer && !props.quiz.correct) {
    return "quiz-choice-wrong";
  }
  return "";
}
</script>
