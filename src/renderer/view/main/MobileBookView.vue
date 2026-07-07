<template>
  <div class="root">
    <div v-if="!bookStore.isLoaded" class="empty-message">
      {{ t.noBookFileLoaded }}
    </div>
    <div v-else-if="moveList.length === 0" class="empty-message">
      {{ t.noBookMovesForThisPosition }}
    </div>
    <div v-else class="list">
      <div
        v-for="entry of moveList"
        :key="entry.usi"
        class="move-row"
        @click="onPlay(entry.move)"
      >
        <span class="move-name">{{ entry.moveName }}</span>
        <span class="count">{{ entry.count !== undefined ? `× ${entry.count}` : "-" }}</span>
        <span
          v-if="entry.evaluationLabel"
          class="eval-badge"
          :class="entry.evaluationClass"
          >{{ entry.evaluationLabel }}</span
        >
        <span v-else class="eval-badge eval-none">-</span>
        <span v-if="entry.repetition" class="repetition-badge">{{ t.repetition }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SbkMoveEvaluation } from "@/common/book";
import { AppState } from "@/common/control/state";
import { t } from "@/common/i18n";
import { humanPlayer } from "@/renderer/players/human";
import { useBookStore } from "@/renderer/store/book";
import { useStore } from "@/renderer/store";
import { computed } from "vue";
import { formatMove, Move } from "tsshogi";

const store = useStore();
const bookStore = useBookStore();

const evaluationLabels: Partial<Record<number, string>> = {
  [SbkMoveEvaluation.Forced]: t.forced,
  [SbkMoveEvaluation.Good]: t.goodMove,
  [SbkMoveEvaluation.Bad]: t.dubious,
  [SbkMoveEvaluation.Blunder]: t.mistake,
};

const evaluationClasses: Partial<Record<number, string>> = {
  [SbkMoveEvaluation.Forced]: "eval-forced",
  [SbkMoveEvaluation.Good]: "eval-good",
  [SbkMoveEvaluation.Bad]: "eval-bad",
  [SbkMoveEvaluation.Blunder]: "eval-blunder",
};

const moveList = computed(() => {
  const position = store.record.position;
  return bookStore.moves
    .map((entry) => {
      const move = position.createMoveByUSI(entry.usi);
      if (!move) return null;
      return {
        move,
        usi: entry.usi,
        moveName: formatMove(position, move),
        count: entry.count,
        evaluationLabel: entry.sbkEval ? evaluationLabels[entry.sbkEval] : undefined,
        evaluationClass: entry.sbkEval ? evaluationClasses[entry.sbkEval] : undefined,
        repetition: entry.repetition,
      };
    })
    .filter((e) => e !== null);
});

const onPlay = (move: Move) => {
  if (store.appState === AppState.GAME || store.appState === AppState.CSA_GAME) {
    humanPlayer.doMove(move);
  } else {
    store.doMove(move);
  }
};
</script>

<style scoped>
.root {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
}
.empty-message {
  padding: 16px;
  color: var(--text-color);
  font-size: 0.9em;
  text-align: center;
}
.list {
  width: 100%;
}
.move-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--text-separator-color);
  cursor: pointer;
  min-height: 44px;
}
.move-row:active {
  background-color: var(--pushed-selector-bg-color);
  color: var(--pushed-selector-color);
}
.move-name {
  font-size: 1.1em;
  font-weight: bold;
  color: var(--text-color);
  min-width: 5em;
}
.count {
  font-size: 0.85em;
  color: var(--text-color);
  min-width: 4em;
}
.eval-badge {
  display: inline-block;
  font-size: 0.75em;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--text-separator-color);
  color: var(--text-color);
  background-color: var(--text-bg-color);
  white-space: nowrap;
}
.eval-none {
  opacity: 0.4;
}
.eval-forced {
  color: #fff;
  background-color: #1976d2;
  border-color: #004a94;
}
.eval-good {
  color: #fff;
  background-color: #388e3c;
  border-color: #116d16;
}
.eval-bad {
  color: #fff;
  background-color: #cf6800;
  border-color: #bc5e00;
}
.eval-blunder {
  color: #fff;
  background-color: #d32f2f;
  border-color: #b00e0e;
}
.repetition-badge {
  display: inline-block;
  font-size: 0.75em;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--text-separator-color);
  color: var(--text-color);
  background-color: var(--text-bg-color);
  white-space: nowrap;
}
</style>
