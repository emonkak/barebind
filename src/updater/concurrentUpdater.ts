import { Atom } from '../directives/signal.js';
import { type Scheduler, getDefaultScheduler } from '../scheduler.js';
import {
  type Effect,
  EffectPhase,
  type TaskPriority,
  type UnitOfWork,
  type UpdateContext,
  type Updater,
} from '../types.js';

export interface ConcurrentUpdaterOptions {
  scheduler?: Scheduler;
  taskCount?: Atom<number>;
}

export class ConcurrentUpdater<TContext> implements Updater<TContext> {
  private readonly _context: UpdateContext<TContext>;

  private readonly _scheduler: Scheduler;

  private readonly _taskCount = new Atom(0);

  private _currentUnitOfWork: UnitOfWork<TContext> | null = null;

  private _pendingUnitOfWorks: UnitOfWork<TContext>[] = [];

  private _pendingLayoutEffects: Effect[] = [];

  private _pendingMutationEffects: Effect[] = [];

  private _pendingPassiveEffects: Effect[] = [];

  constructor(
    context: UpdateContext<TContext>,
    {
      scheduler = getDefaultScheduler(),
      taskCount = new Atom(0),
    }: ConcurrentUpdaterOptions = {},
  ) {
    this._context = context;
    this._scheduler = scheduler;
    this._taskCount = taskCount;
  }

  getCurrentUnitOfWork(): UnitOfWork<TContext> | null {
    return this._currentUnitOfWork;
  }

  getCurrentPriority(): TaskPriority {
    const currentEvent = window.event;
    if (currentEvent !== undefined) {
      return isContinuousEvent(currentEvent) ? 'user-visible' : 'user-blocking';
    } else {
      return 'user-visible';
    }
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
      this._taskCount.value > 0 ||
      this._pendingUnitOfWorks.length > 0 ||
      this._pendingLayoutEffects.length > 0 ||
      this._pendingMutationEffects.length > 0 ||
      this._pendingPassiveEffects.length > 0
    );
  }

  isScheduled(): boolean {
    return this._taskCount.value > 0;
  }

  scheduleUpdate(): void {
    if (this._currentUnitOfWork !== null) {
      return;
    }
    this._scheduleRenderPipelines();
    this._scheduleUnitOfWorkingEffects();
    this._schedulePassiveEffects();
  }

  waitForUpdate(): Promise<void> {
    const taskCount = this._taskCount;
    if (taskCount.value > 0) {
      return new Promise((resolve) => {
        const subscription = taskCount.subscribe(() => {
          if (taskCount.value === 0) {
            subscription();
            resolve();
          }
        });
      });
    } else {
      return Promise.resolve();
    }
  }

  private _beginRenderPipeline(): ConcurrentUpdater<TContext> {
    return new ConcurrentUpdater(this._context, {
      scheduler: this._scheduler,
      taskCount: this._taskCount,
    });
  }

  private async _updateUnitOfWork(
    rootUnitOfWork: UnitOfWork<TContext>,
  ): Promise<void> {
    let pendingUnitOfWorks = [rootUnitOfWork];
    let startTime = this._scheduler.getCurrentTime();

    do {
      for (let i = 0, l = pendingUnitOfWorks.length; i < l; i++) {
        const unitOfWork = pendingUnitOfWorks[i]!;
        if (!unitOfWork.shouldPerformWork()) {
          unitOfWork.cancelWork();
          continue;
        }

        if (
          this._scheduler.shouldYieldToMain(
            this._scheduler.getCurrentTime() - startTime,
          )
        ) {
          await this._scheduler.yieldToMain({
            priority: unitOfWork.priority,
          });
          startTime = this._scheduler.getCurrentTime();
        }

        this._currentUnitOfWork = unitOfWork;
        try {
          unitOfWork.performWork(this._context, this);
        } finally {
          this._currentUnitOfWork = null;
        }
      }

      pendingUnitOfWorks = this._pendingUnitOfWorks;
      this._pendingUnitOfWorks = [];
    } while (pendingUnitOfWorks.length > 0);

    this._scheduleUnitOfWorkingEffects();
    this._schedulePassiveEffects();
  }

  private _scheduleRenderPipelines(): void {
    const pendingUnitOfWorks = this._pendingUnitOfWorks;
    this._pendingUnitOfWorks = [];

    for (let i = 0, l = pendingUnitOfWorks.length; i < l; i++) {
      const unitOfWork = pendingUnitOfWorks[i]!;
      this._scheduler.requestCallback(
        async () => {
          try {
            await this._beginRenderPipeline()._updateUnitOfWork(unitOfWork);
          } finally {
            this._taskCount.value--;
          }
        },
        {
          priority: unitOfWork.priority,
        },
      );
      this._taskCount.value++;
    }
  }

  private _scheduleUnitOfWorkingEffects(): void {
    const pendingMutationEffects = this._pendingMutationEffects;
    const pendingLayoutEffects = this._pendingLayoutEffects;

    if (pendingMutationEffects.length > 0 || pendingLayoutEffects.length > 0) {
      this._pendingMutationEffects = [];
      this._pendingLayoutEffects = [];

      this._scheduler.requestCallback(
        () => {
          try {
            this._context.flushEffects(
              pendingMutationEffects,
              EffectPhase.Mutation,
            );
            this._context.flushEffects(
              pendingLayoutEffects,
              EffectPhase.Layout,
            );
          } finally {
            this._taskCount.value--;
          }
        },
        { priority: 'user-blocking' },
      );
      this._taskCount.value++;
    }
  }

  private _schedulePassiveEffects(): void {
    const pendingPassiveEffects = this._pendingPassiveEffects;

    if (pendingPassiveEffects.length > 0) {
      this._pendingPassiveEffects = [];

      this._scheduler.requestCallback(
        () => {
          try {
            this._context.flushEffects(
              pendingPassiveEffects,
              EffectPhase.Passive,
            );
          } finally {
            this._taskCount.value--;
          }
        },
        { priority: 'background' },
      );
      this._taskCount.value++;
    }
  }
}

function isContinuousEvent(event: Event): boolean {
  switch (event.type as keyof DocumentEventMap) {
    case 'drag':
    case 'dragenter':
    case 'dragleave':
    case 'dragover':
    case 'mouseenter':
    case 'mouseleave':
    case 'mousemove':
    case 'mouseout':
    case 'mouseover':
    case 'pointerenter':
    case 'pointerleave':
    case 'pointermove':
    case 'pointerout':
    case 'pointerover':
    case 'scroll':
    case 'touchmove':
    case 'wheel':
      return true;
    default:
      return false;
  }
}
