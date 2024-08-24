import {
  CommitPhase,
  type RenderHost,
  UpdateContext,
  type UpdateQueue,
  type Updater,
  createUpdateQueue,
} from '../baseTypes.js';
import { State } from '../directives/signal.js';
import { type Scheduler, getDefaultScheduler } from '../scheduler.js';

export interface ConcurrentUpdaterOptions {
  scheduler?: Scheduler;
}

export class ConcurrentUpdater<TContext> implements Updater<TContext> {
  private readonly _scheduler: Scheduler;

  private readonly _taskCount: State<number> = new State(0);

  private readonly _processingQueues: WeakSet<UpdateQueue<TContext>> =
    new WeakSet();

  constructor({
    scheduler = getDefaultScheduler(),
  }: ConcurrentUpdaterOptions = {}) {
    this._scheduler = scheduler;
  }

  async flushUpdate(
    queue: UpdateQueue<TContext>,
    host: RenderHost<TContext>,
  ): Promise<void> {
    this._processingQueues.add(queue);

    try {
      const { blocks } = queue;
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

          const context = new UpdateContext(host, this, block, queue);

          block.update(context);
        } while (++i < l);
      }
    } finally {
      queue.blocks.length = 0;
      this._processingQueues.delete(queue);
    }

    this._scheduleEffects(queue, host);
  }

  isScheduled(): boolean {
    return this._taskCount.value > 0;
  }

  scheduleUpdate(
    queue: UpdateQueue<TContext>,
    host: RenderHost<TContext>,
  ): void {
    if (this._processingQueues.has(queue)) {
      // Block an update while rendering.
      return;
    }
    this._scheduleBlocks(queue, host);
    this._scheduleEffects(queue, host);
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

  private _scheduleBlocks(
    queue: UpdateQueue<TContext>,
    host: RenderHost<TContext>,
  ): void {
    const { blocks } = queue;

    for (let i = 0, l = blocks.length; i < l; i++) {
      const block = blocks[i]!;
      this._scheduler.requestCallback(
        async () => {
          try {
            const queue = createUpdateQueue([block]);
            await this.flushUpdate(queue, host);
          } finally {
            this._taskCount.value--;
          }
        },
        {
          priority: block.priority,
        },
      );
      this._taskCount.value++;
    }

    queue.blocks = [];
  }

  private _scheduleEffects(
    queue: UpdateQueue<TContext>,
    host: RenderHost<TContext>,
  ): void {
    const { passiveEffects, mutationEffects, layoutEffects } = queue;

    if (mutationEffects.length > 0) {
      this._scheduler.requestCallback(
        () => {
          try {
            host.flushEffects(mutationEffects, CommitPhase.Mutation);
          } finally {
            this._taskCount.value--;
          }
        },
        { priority: 'user-blocking' },
      );

      queue.mutationEffects = [];

      this._taskCount.value++;
    }

    if (layoutEffects.length > 0) {
      this._scheduler.requestCallback(
        () => {
          try {
            host.flushEffects(layoutEffects, CommitPhase.Layout);
          } finally {
            this._taskCount.value--;
          }
        },
        { priority: 'user-blocking' },
      );

      queue.layoutEffects = [];

      this._taskCount.value++;
    }

    if (passiveEffects.length > 0) {
      this._scheduler.requestCallback(
        () => {
          try {
            host.flushEffects(passiveEffects, CommitPhase.Passive);
          } finally {
            this._taskCount.value--;
          }
        },
        { priority: 'background' },
      );

      queue.passiveEffects = [];

      this._taskCount.value++;
    }
  }
}
