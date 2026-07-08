/* eslint-disable no-console */
import { reactive, UnwrapNestedRefs } from "vue";
import { formatMove, Position } from "tsshogi";
import { fetchPolicyRates } from "@/renderer/external/policyRateClient.js";
import { useStore } from "@/renderer/store/index.js";

export type PolicyMoveDisplay = {
  usi: string;
  moveName: string;
  percent: string;
  rate: number;
};

export type PolicyErrorKind = "connection" | "empty" | "exception" | null;

class PolicyRateStore {
  moves: PolicyMoveDisplay[] = [];
  loading = false;
  errorKind: PolicyErrorKind = null;
  private _requestId = 0;

  async fetchForSfen(sfen: string): Promise<void> {
    const requestId = ++this._requestId;

    console.log("[PolicyRate] fetchForSfen start, sfen:", sfen, "requestId:", requestId);
    this.loading = true;
    this.errorKind = null;

    try {
      const result = await fetchPolicyRates(sfen);

      if (requestId !== this._requestId) {
        console.log("[PolicyRate] stale response ignored, requestId:", requestId);
        return;
      }

      if (!result) {
        console.log("[PolicyRate] no result → connection error");
        this.errorKind = "connection";
        this.moves = [];
        return;
      }

      if (result.moves.length === 0) {
        console.log("[PolicyRate] empty moves");
        this.errorKind = "empty";
        this.moves = [];
        return;
      }

      const position = Position.newBySFEN(sfen);
      this.moves = result.moves.map((m) => {
        if (!position) {
          return { usi: m.usi, moveName: m.usi, percent: m.percent, rate: m.rate };
        }
        const move = position.createMoveByUSI(m.usi);
        return {
          usi: m.usi,
          moveName: move ? formatMove(position, move) : m.usi,
          percent: m.percent,
          rate: m.rate,
        };
      });
      this.errorKind = null;
      console.log("[PolicyRate] moves set:", this.moves.length);
    } catch (e) {
      console.log("[PolicyRate] unexpected error:", e);
      if (requestId === this._requestId) {
        this.errorKind = "exception";
        this.moves = [];
      }
    } finally {
      if (requestId === this._requestId) {
        this.loading = false;
        console.log("[PolicyRate] loading cleared for requestId:", requestId);
      }
    }
  }
}

let store: UnwrapNestedRefs<PolicyRateStore>;

export function usePolicyRateStore(): UnwrapNestedRefs<PolicyRateStore> {
  if (!store) {
    store = reactive(new PolicyRateStore());
    const appStore = useStore();

    const handler = () => {
      const sfen = appStore.record.position.sfen;
      store.fetchForSfen(sfen);
    };

    appStore.addEventListener("changePosition", handler);

    const initialSfen = appStore.record.position.sfen;
    console.log("[PolicyRate] initial fetch for sfen:", initialSfen);
    store.fetchForSfen(initialSfen);
  }
  return store;
}
