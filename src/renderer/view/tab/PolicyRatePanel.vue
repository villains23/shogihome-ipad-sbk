<template>
  <div class="policy-rate-panel">
    <div class="panel-title">AI採択率 上位7手</div>
    <div v-if="store.loading" class="status-text">読み込み中...</div>
    <div v-else-if="store.errorKind === 'connection'" class="status-text muted">
      Policy APIに接続できません
    </div>
    <div v-else-if="store.errorKind === 'empty'" class="status-text muted">
      採択率候補がありません
    </div>
    <div v-else-if="store.errorKind === 'exception'" class="status-text muted">
      採択率の取得に失敗しました
    </div>
    <div v-else-if="store.moves.length === 0" class="status-text muted">-</div>
    <table v-else class="moves-table">
      <tbody>
        <tr v-for="(m, i) in store.moves" :key="m.usi">
          <td class="rank">{{ i + 1 }}.</td>
          <td class="move-name">{{ m.moveName }}</td>
          <td class="percent">{{ m.percent }}</td>
          <td class="bar-cell">
            <div class="bar" :style="{ width: `${Math.round(m.rate * 100)}%` }"></div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { usePolicyRateStore } from "@/renderer/store/policyRate.js";

const store = usePolicyRateStore();
</script>

<style scoped>
.policy-rate-panel {
  padding: 4px 6px;
  background-color: var(--text-bg-color);
  border-bottom: 1px solid var(--text-separator-color);
  font-size: 12px;
  color: var(--text-color);
}
.panel-title {
  font-weight: bold;
  font-size: 11px;
  margin-bottom: 2px;
  opacity: 0.7;
}
.status-text {
  font-size: 11px;
  padding: 2px 0;
}
.muted {
  opacity: 0.5;
}
.moves-table {
  border-collapse: collapse;
  width: 100%;
}
.moves-table td {
  padding: 1px 3px;
  vertical-align: middle;
  white-space: nowrap;
}
.rank {
  text-align: right;
  width: 1.5em;
  opacity: 0.6;
}
.move-name {
  min-width: 5em;
}
.percent {
  text-align: right;
  min-width: 4em;
  font-weight: bold;
}
.bar-cell {
  width: 80px;
  padding-left: 6px;
}
.bar {
  height: 8px;
  background-color: var(--tab-highlight-color, #1976d2);
  border-radius: 2px;
  opacity: 0.6;
  min-width: 2px;
}
</style>
