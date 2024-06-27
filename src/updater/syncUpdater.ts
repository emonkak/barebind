import type {
  Block,
  Effect,
  TaskPriority,
  UpdateContext,
  Updater,
} from '../types.js';

export class SyncUpdater<TContext> implements Updater<TContext> {
  private readonly _context: UpdateContext<TContext>;

  private _currentBlock: Block<TContext> | null = null;

  private _pendingBlocks: Block<TContext>[] = [];

  private _pendingMutationEffects: Effect[] = [];

  private _pendingLayoutEffects: Effect[] = [];

  private _pendingPassiveEffects: Effect[] = [];

  private _isScheduled = false;

  constructor(context: UpdateContext<TContext>) {
    this._context = context;
  }

  getCurrentBlock(): Block<TContext> | null {
    return this._currentBlock;
  }

  getCurrentPriority(): TaskPriority {
    return 'user-blocking';
  }

  enqueueBlock(block: Block<TContext>): void {
    this._pendingBlocks.push(block);
  }

  enqueueLayoutEffect(effect: Effect): void {
    this._pendingLayoutEffects.push(effect);
  }

  enqueueMutationEffect(effect: Effect): void {
    this._pendingMutationEffects.push(effect);
  }

  enqueuePassiveEffect(effect: Effect): void {
    this._pendingPassiveEffects.push(effect);
  }

  isPending(): boolean {
    return (
      this._pendingBlocks.length > 0 ||
      this._pendingLayoutEffects.length > 0 ||
      this._pendingMutationEffects.length > 0 ||
      this._pendingPassiveEffects.length > 0
    );
  }

  isScheduled(): boolean {
    return this._isScheduled;
  }

  scheduleUpdate(): void {
    if (this._isScheduled) {
      return;
    }

    queueMicrotask(() => {
      if (this._isScheduled) {
        this.flush();
      }
    });

    this._isScheduled = true;
  }

  waitForUpdate(): Promise<void> {
    return this._isScheduled ? new Promise(queueMicrotask) : Promise.resolve();
  }

  flush(): void {
    try {
      do {
        while (this._pendingBlocks.length > 0) {
          const pendingBlocks = this._pendingBlocks;
          this._pendingBlocks = [];

          for (let i = 0, l = pendingBlocks.length; i < l; i++) {
            const block = pendingBlocks[i]!;
            if (!block.shouldUpdate()) {
              continue;
            }
            this._currentBlock = block;
            try {
              block.update(this._context, this);
            } finally {
              this._currentBlock = null;
            }
          }
        }

        if (this._pendingMutationEffects.length > 0) {
          const pendingMutationEffects = this._pendingMutationEffects;
          this._pendingMutationEffects = [];
          this._context.flushEffects(pendingMutationEffects, 'mutation');
        }

        if (this._pendingLayoutEffects.length > 0) {
          const pendingLayoutEffects = this._pendingLayoutEffects;
          this._pendingLayoutEffects = [];
          this._context.flushEffects(pendingLayoutEffects, 'layout');
        }

        if (this._pendingPassiveEffects.length > 0) {
          const pendingPassiveEffects = this._pendingPassiveEffects;
          this._pendingPassiveEffects = [];
          this._context.flushEffects(pendingPassiveEffects, 'passive');
        }
      } while (
        this._pendingBlocks.length > 0 ||
        this._pendingMutationEffects.length > 0 ||
        this._pendingLayoutEffects.length > 0 ||
        this._pendingPassiveEffects.length > 0
      );
    } finally {
      this._isScheduled = false;
    }
  }
}
