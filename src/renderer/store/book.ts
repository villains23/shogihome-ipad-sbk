/* eslint-disable no-console */
import { BookFormat, BookMove, BookMoveEx, defaultBookSession } from "@/common/book.js";
import { reactive, UnwrapNestedRefs } from "vue";
import { useStore } from ".";
import api from "@/renderer/ipc/api.js";
import { useErrorStore } from "./error.js";
import { useBusyState } from "./busy.js";
import { useConfirmationStore } from "./confirm.js";
import { useMessageStore } from "./message.js";
import { useAppSettings } from "./settings.js";
import { BookImportSettings } from "@/common/settings/book.js";
import { t } from "@/common/i18n/index.js";
import { ImmutableRecord } from "tsshogi";
import { flippedSFEN, flippedUSIMove } from "@/common/helpers/sfen.js";

export class BookStore {
  private _moves: BookMoveEx[] = [];
  private _format: BookFormat = "yane2016";
  private _isLoaded = false;
  private _bookArrowsVisible = true;
  private _reactive: UnwrapNestedRefs<BookStore>;

  constructor(private record: ImmutableRecord) {
    this._reactive = reactive(this);
  }

  get reactive(): UnwrapNestedRefs<BookStore> {
    return this._reactive;
  }

  get moves(): BookMoveEx[] {
    return this._moves;
  }

  get format(): BookFormat {
    return this._format;
  }

  get isLoaded(): boolean {
    return this._isLoaded;
  }

  get bookArrowsVisible(): boolean {
    return this._bookArrowsVisible;
  }

  toggleBookArrows() {
    this._bookArrowsVisible = !this._bookArrowsVisible;
  }

  async reloadBookMoves() {
    try {
      const sfen = this.record.position.sfen;
      console.log("[SBK] reloadBookMoves isLoaded:", this._isLoaded, "sfen:", sfen);
      const moves = await this.searchMoves(sfen);
      this._moves = moves.map((bookMove) => {
        const position = this.record.position.clone();
        const move = position.createMoveByUSI(bookMove.usi);
        let repetition = 0;
        if (move) {
          position.doMove(move);
          repetition = this.record.getRepetitionCount(position);
        }
        return {
          ...bookMove,
          repetition,
        } as BookMoveEx;
      });
      console.log("[SBK] reloadBookMoves done, moves:", this._moves.length);
    } catch (e) {
      useErrorStore().add(e);
    }
  }

  onChangePosition(record: ImmutableRecord) {
    this.record = record;
    this.reloadBookMoves();
  }

  reset(format?: BookFormat) {
    if (useBusyState().isBusy) {
      return;
    }
    useConfirmationStore().show({
      message: t.anyUnsavedDataWillBeLostDoYouReallyWantToResetBookData,
      onOk: () => {
        useBusyState().retain();
        api
          .clearBook(defaultBookSession, format)
          .then(() => {
            this._format = format || "yane2016";
            this._isLoaded = false;
            return this.reloadBookMoves();
          })
          .catch((e) => {
            useErrorStore().add(e);
          })
          .finally(() => {
            useBusyState().release();
          });
      },
    });
  }

  openBookFile() {
    // Show the file picker before retaining busy state so that iOS Safari does not
    // block the native picker behind a "processing" overlay, and so a cancelled
    // picker never leaves the UI stuck in a loading state.
    api
      .showOpenBookDialog()
      .then(async (path) => {
        console.log("[SBK] showOpenBookDialog resolved:", path ? path : "(cancelled)");
        if (!path) {
          return;
        }
        useBusyState().retain();
        try {
          await api.openBook(defaultBookSession, path, {
            yaneOnTheFlyThresholdMB: useAppSettings().yaneBookOnTheFlyThresholdMB,
            aperyOnTheFlyThresholdMB: useAppSettings().aperyBookOnTheFlyThresholdMB,
            sbkOnTheFlyThresholdMB: useAppSettings().sbkOnTheFlyThresholdMB,
            ybbOnTheFlyThresholdMB: useAppSettings().ybbOnTheFlyThresholdMB,
          });
          this._format = await api.getBookFormat(defaultBookSession);
          this._isLoaded = true;
          console.log("[SBK] BookStore isLoaded:", this._isLoaded, "format:", this._format);
          await this.reloadBookMoves();
          console.log("[SBK] openBookFile complete, moves:", this._moves.length);
        } catch (e) {
          console.log("[SBK] ERROR in openBookFile:", e);
          useErrorStore().add(e);
        } finally {
          useBusyState().release();
        }
      })
      .catch((e) => {
        console.log("[SBK] ERROR in showOpenBookDialog:", e);
        useErrorStore().add(e);
      });
  }

  saveBookFile() {
    if (useBusyState().isBusy) {
      return;
    }
    useBusyState().retain();
    api
      .showSaveBookDialog(defaultBookSession)
      .then(async (path) => {
        if (path) {
          await api.saveBook(defaultBookSession, path);
        }
      })
      .catch((e) => {
        useErrorStore().add(e);
      })
      .finally(() => {
        useBusyState().release();
      });
  }

  exportBookFile(targetFormat: BookFormat) {
    if (useBusyState().isBusy) {
      return;
    }
    const doExport = () => {
      useBusyState().retain();
      api
        .showSaveBookDialog(defaultBookSession, targetFormat)
        .then(async (path) => {
          if (path) {
            await api.exportBook(defaultBookSession, path, targetFormat);
          }
        })
        .catch((e) => {
          useErrorStore().add(e);
        })
        .finally(() => {
          useBusyState().release();
        });
    };
    useConfirmationStore().show({
      message: t.memoryShortageOnBookConversionMayLoseUnsavedData,
      onOk: doExport,
    });
  }

  async updateMove(sfen: string, move: BookMove) {
    useBusyState().retain();
    return api
      .updateBookMove(defaultBookSession, sfen, move)
      .then(() => this.reloadBookMoves())
      .finally(() => {
        useBusyState().release();
      });
  }

  removeMove(sfen: string, usi: string) {
    useBusyState().retain();
    api
      .removeBookMove(defaultBookSession, sfen, usi)
      .then(() => this.reloadBookMoves())
      .catch((e) => {
        useErrorStore().add(e);
      })
      .finally(() => {
        useBusyState().release();
      });
  }

  updateMoveOrder(sfen: string, usi: string, order: number) {
    useBusyState().retain();
    api
      .updateBookMoveOrder(defaultBookSession, sfen, usi, order)
      .then(() => this.reloadBookMoves())
      .catch((e) => {
        useErrorStore().add(e);
      })
      .finally(() => {
        useBusyState().release();
      });
  }

  async searchMoves(sfen: string): Promise<BookMove[]> {
    const moves = await api.searchBookMoves(defaultBookSession, sfen);
    if (moves.length !== 0) {
      return moves;
    }
    const appSettings = useAppSettings();
    if (!appSettings.flippedBook) {
      return [];
    }
    return (await api.searchBookMoves(defaultBookSession, flippedSFEN(sfen))).map((move) => {
      move.usi = flippedUSIMove(move.usi);
      if (move.usi2) {
        move.usi2 = flippedUSIMove(move.usi2);
      }
      return move;
    });
  }

  importBookMoves(settings: BookImportSettings) {
    useBusyState().retain();
    api
      .saveBookImportSettings(settings)
      .then(() => api.importBookMoves(defaultBookSession, settings))
      .then((summary) => {
        const items = [
          {
            text: t.file,
            children: [
              `${t.success}: ${summary.successFileCount}`,
              `${t.failed}: ${summary.errorFileCount}`,
              `${t.skipped}: ${summary.skippedFileCount}`,
            ],
          },
        ];
        if (summary.entryCount !== undefined && summary.duplicateCount !== undefined) {
          items.push({
            text: t.moveEntry,
            children: [
              `${t.new}: ${summary.entryCount}`,
              `${t.duplicated}: ${summary.duplicateCount}`,
            ],
          });
        }
        useMessageStore().enqueue({
          text: t.bookMovesWereImported,
          attachments: [{ type: "list", items }],
          withCopyButton: true,
        });
        return this.reloadBookMoves();
      })
      .catch((e) => {
        useErrorStore().add(e);
      })
      .finally(() => {
        useBusyState().release();
      });
  }
}

export function createBookStore(): UnwrapNestedRefs<BookStore> {
  const store = useStore();
  const bookStore = new BookStore(store.record).reactive;
  store.addEventListener("changePosition", () => {
    bookStore.onChangePosition(store.record);
  });
  return bookStore;
}

let store: UnwrapNestedRefs<BookStore>;

export function useBookStore(): UnwrapNestedRefs<BookStore> {
  if (!store) {
    store = createBookStore();
  }
  return store;
}
