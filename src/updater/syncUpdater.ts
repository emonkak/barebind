import {
  type Effect,
  EffectPhase,
  type TaskPriority,
  type UnitOfWork,
  type UpdateContext,
  type Updater,
} from '../types.js';

export class SyncUpdater<TContext> implements Updater<TContext> {
  private readonly _context: UpdateContext<TContext>;

  private _currentUnitOfWork: UnitOfWork<TContext> | null = null;

  private _pendingUnitOfWorks: UnitOfWork<TContext>[] = [];

  private _pendingMutationEffects: Effect[] = [];

  private _pendingLayoutEffects: Effect[] = [];

  private _pendingPassiveEffects: Effect[] = [];

  private _isScheduled = false;

  constructor(context: UpdateContext<TContext>) {
    this._context = context;
  }

  getCurrentUnitOfWork(): UnitOfWork<TContext> | null {
    return this._currentUnitOfWork;
  }

  getCurrentPriority(): TaskPriority {
    return 'user-blocking';
  }

  enqueueUnitOfWork(unitOfWork: UnitOfWork<TContext>): void {
    this._pendingUnitOfWorks.push(unitOfWork);
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
      this._pendingUnitOfWorks.length > 0 ||
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
        while (this._pendingUnitOfWorks.length > 0) {
          const pendingUnitOfWorks = this._pendingUnitOfWorks;
          this._pendingUnitOfWorks = [];

          for (let i = 0, l = pendingUnitOfWorks.length; i < l; i++) {
            const unitOfWork = pendingUnitOfWorks[i]!;
            if (!unitOfWork.shouldPerformWork()) {
              unitOfWork.cancelWork();
              continue;
            }
            this._currentUnitOfWork = unitOfWork;
            try {
              unitOfWork.performWork(this._context, this);
            } finally {
              this._currentUnitOfWork = null;
            }
          }
        }

        if (this._pendingMutationEffects.length > 0) {
          const pendingMutationEffects = this._pendingMutationEffects;
          this._pendingMutationEffects = [];
          this._context.flushEffects(
            pendingMutationEffects,
            EffectPhase.Mutation,
          );
        }

        if (this._pendingLayoutEffects.length > 0) {
          const pendingLayoutEffects = this._pendingLayoutEffects;
          this._pendingLayoutEffects = [];
          this._context.flushEffects(pendingLayoutEffects, EffectPhase.Layout);
        }

        if (this._pendingPassiveEffects.length > 0) {
          const pendingPassiveEffects = this._pendingPassiveEffects;
          this._pendingPassiveEffects = [];
          this._context.flushEffects(
            pendingPassiveEffects,
            EffectPhase.Passive,
          );
        }
      } while (
        this._pendingUnitOfWorks.length > 0 ||
        this._pendingMutationEffects.length > 0 ||
        this._pendingLayoutEffects.length > 0 ||
        this._pendingPassiveEffects.length > 0
      );
    } finally {
      this._isScheduled = false;
    }
  }
}
