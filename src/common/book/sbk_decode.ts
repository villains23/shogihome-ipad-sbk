import { InitialPositionSFEN, Move, Position } from "tsshogi";
import { SBook, SBookMoveEvaluation, SBookState } from "@/common/book/proto/sbk.js";
import { fromSbkMove } from "@/common/book/sbk_move.js";
import { BookMove } from "@/common/book.js";

export type SbkDecodeResult = {
  entries: Map<string, BookMove[]>;
  sbkAuthor?: string;
  sbkDescription?: string;
};

export function decodeSbkBook(data: Uint8Array): SbkDecodeResult {
  const book = SBook.decode(data);

  // BookConv の実装では先頭の State が Position を持たない場合に平手初期局面とみなしているのでそれに倣う
  if (book.BookStates.length > 0 && !book.BookStates[0].Position) {
    book.BookStates[0].Position = InitialPositionSFEN.STANDARD;
  }

  const entries = new Map<string, BookMove[]>();
  const visitedStateIds = new Set<number>();

  function addEntry(sfen: string, state: SBookState, moves: Move[]): void {
    if (
      state.Moves.length === 0 &&
      state.Evals.length === 0 &&
      !state.Comment &&
      !state.Games &&
      !state.WonBlack &&
      !state.WonWhite
    ) {
      return;
    }
    const bookMoves: BookMove[] = state.Moves.map((m, i) => {
      const bm: BookMove = { usi: moves[i].usi, sbkId: m.NextStateId };
      if (m.Weight) {
        bm.count = m.Weight;
      }
      if (m.Evaluation !== SBookMoveEvaluation.None) {
        bm.sbkEval = m.Evaluation;
      }
      return bm;
    });
    entries.set(sfen, bookMoves);
  }

  for (const rootState of book.BookStates) {
    if (!rootState.Position || visitedStateIds.has(rootState.Id)) {
      continue;
    }
    const pos = Position.newBySFEN(rootState.Position);
    if (!pos) {
      continue;
    }

    const rootMoves = rootState.Moves.map((m) => fromSbkMove(pos, m.Move));
    addEntry(rootState.Position, rootState, rootMoves);
    visitedStateIds.add(rootState.Id);

    const stack: { state: SBookState; moves: Move[]; index: number; lastMove?: Move }[] = [
      { state: rootState, moves: rootMoves, index: 0 },
    ];

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (frame.index >= frame.moves.length) {
        stack.pop();
        if (frame.lastMove) {
          pos.undoMove(frame.lastMove);
        }
        continue;
      }
      const sbkMove = frame.state.Moves[frame.index];
      const move = frame.moves[frame.index];
      frame.index++;

      const nextStateId = sbkMove.NextStateId;
      if (visitedStateIds.has(nextStateId)) {
        continue;
      }
      if (!pos.doMove(move, { ignoreValidation: true })) {
        continue;
      }
      const nextState = book.BookStates[nextStateId];
      if (!nextState) {
        pos.undoMove(move);
        continue;
      }

      const nextSfen = pos.sfen;
      const nextMoves = nextState.Moves.map((m) => fromSbkMove(pos, m.Move));
      addEntry(nextSfen, nextState, nextMoves);
      stack.push({ state: nextState, moves: nextMoves, index: 0, lastMove: move });
      visitedStateIds.add(nextStateId);
    }
  }

  return {
    entries,
    sbkAuthor: book.Author,
    sbkDescription: book.Description,
  };
}
