import {
  CommitPhase,
  RenderFlag,
  type RenderFrame,
  type RenderHost,
  UpdateContext,
  type Updater,
  createRenderFrame,
} from '../baseTypes.js';
import { Atom } from '../directives/signal.js';
import { type Scheduler, getScheduler } from '../scheduler.js';

export interface ConcurrentUpdaterOptions {
  scheduler?: Scheduler;
}

export class ConcurrentUpdater<TContext> implements Updater<TContext> {
  private readonly _scheduler: Scheduler;

  private readonly _pendingTasks: Atom<number> = new Atom(0);

  constructor({ scheduler = getScheduler() }: ConcurrentUpdaterOptions = {}) {
    this._scheduler = scheduler;
  }

  async flushUpdate(
    frame: RenderFrame<TContext>,
    host: RenderHost<TContext>,
  ): Promise<void> {
    frame.flags |= RenderFlag.InProgress;

    try {
      const { blocks } = frame;
      let startTime = this._scheduler.getCurrentTime();

      // block.length may be grow.
      for (let i = 0, l = blocks.length; i < l; l = blocks.length) {
        do {
          const block = blocks[i]!;
          if (!block.shouldUpdate()) {
            block.cancelUpdate();
            continue;
          }

          if (
            this._scheduler.shouldYieldToMain(
              this._scheduler.getCurrentTime() - startTime,
            )
          ) {
            await this._scheduler.yieldToMain();
            startTime = this._scheduler.getCurrentTime();
          }

          const context = new UpdateContext(host, this, block, frame);
          block.update(context);
        } while (++i < l);
      }
    } finally {
      frame.blocks = [];
      frame.flags &= ~RenderFlag.InProgress;
    }

    this._scheduleEffects(frame, host);
  }

  isScheduled(): boolean {
    return this._pendingTasks.value > 0;
  }

  scheduleUpdate(
    frame: RenderFrame<TContext>,
    host: RenderHost<TContext>,
  ): void {
    if ((frame.flags & RenderFlag.InProgress) !== 0) {
      // Prevent an update when an update is in progress.
      return;
    }
    this._scheduleBlocks(frame, host);
    this._scheduleEffects(frame, host);
  }

  waitForUpdate(): Promise<void> {
    const pendingTasks = this._pendingTasks;
    if (pendingTasks.value > 0) {
      return new Promise((resolve) => {
        const subscription = pendingTasks.subscribe(() => {
          if (pendingTasks.value === 0) {
            subscription();
            resolve();
          }
        });
      });
    } else {
      return Promise.resolve();
    }
  }

  private _scheduleBlocks(
    frame: RenderFrame<TContext>,
    host: RenderHost<TContext>,
  ): void {
    const { blocks } = frame;

    for (let i = 0, l = blocks.length; i < l; i++) {
      const block = blocks[i]!;
      this._scheduler.requestCallback(
        async () => {
          try {
            const childQueue = createRenderFrame(frame.flags);
            childQueue.blocks.push(block);
            await this.flushUpdate(childQueue, host);
          } finally {
            this._pendingTasks.value--;
          }
        },
        {
          priority: block.priority,
        },
      );
      this._pendingTasks.value++;
    }

    frame.blocks = [];
  }

  private _scheduleEffects(
    frame: RenderFrame<TContext>,
    host: RenderHost<TContext>,
  ): void {
    const { passiveEffects, mutationEffects, layoutEffects, flags } = frame;

    if (mutationEffects.length > 0 || layoutEffects.length > 0) {
      const shouldStartViewTransition =
        (flags & RenderFlag.ViewTransition) !== 0;
      if (shouldStartViewTransition) {
        host.startViewTransition(() => {
          try {
            host.flushEffects(mutationEffects, CommitPhase.Mutation);
            host.flushEffects(layoutEffects, CommitPhase.Layout);
          } finally {
            this._pendingTasks.value--;
          }
        });
      } else {
        this._scheduler.requestCallback(
          () => {
            try {
              host.flushEffects(mutationEffects, CommitPhase.Mutation);
              host.flushEffects(layoutEffects, CommitPhase.Layout);
            } finally {
              this._pendingTasks.value--;
            }
          },
          { priority: 'user-blocking' },
        );
      }
      this._pendingTasks.value++;
      frame.mutationEffects = [];
      frame.layoutEffects = [];
    }

    if (passiveEffects.length > 0) {
      this._scheduler.requestCallback(
        () => {
          try {
            host.flushEffects(passiveEffects, CommitPhase.Passive);
          } finally {
            this._pendingTasks.value--;
          }
        },
        { priority: 'background' },
      );
      this._pendingTasks.value++;
      frame.passiveEffects = [];
    }

    frame.flags &= ~RenderFlag.ViewTransition;
  }
}
