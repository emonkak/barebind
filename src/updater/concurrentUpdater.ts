import {
  CommitPhase,
  UpdateContext,
  type UpdatePipeline,
  type UpdateRuntime,
  type Updater,
  createUpdatePipeline,
} from '../baseTypes.js';
import { Atom } from '../directives/signal.js';
import { type Scheduler, getDefaultScheduler } from '../scheduler.js';

export interface ConcurrentUpdaterOptions {
  scheduler?: Scheduler;
}

export class ConcurrentUpdater<TContext> implements Updater<TContext> {
  private readonly _scheduler: Scheduler;

  private readonly _taskCount: Atom<number> = new Atom(0);

  private readonly _processingPipelines: WeakSet<UpdatePipeline<TContext>> =
    new WeakSet();

  constructor({
    scheduler = getDefaultScheduler(),
  }: ConcurrentUpdaterOptions = {}) {
    this._scheduler = scheduler;
  }

  async flushUpdate(
    pipeline: UpdatePipeline<TContext>,
    host: UpdateRuntime<TContext>,
  ): Promise<void> {
    this._processingPipelines.add(pipeline);

    try {
      const { blocks } = pipeline;
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
            await this._scheduler.yieldToMain({
              priority: block.priority,
            });
            startTime = this._scheduler.getCurrentTime();
          }

          const context = new UpdateContext(host, this, block, pipeline);

          block.update(context);
        } while (++i < l);
      }
    } finally {
      pipeline.blocks.length = 0;
      this._processingPipelines.delete(pipeline);
    }

    this._scheduleEffects(pipeline, host);
  }

  isScheduled(): boolean {
    return this._taskCount.value > 0;
  }

  scheduleUpdate(
    pipeline: UpdatePipeline<TContext>,
    host: UpdateRuntime<TContext>,
  ): void {
    if (this._processingPipelines.has(pipeline)) {
      // Block an update while rendering.
      return;
    }
    this._scheduleBlocks(pipeline, host);
    this._scheduleEffects(pipeline, host);
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
    pipeline: UpdatePipeline<TContext>,
    host: UpdateRuntime<TContext>,
  ): void {
    const { blocks } = pipeline;

    for (let i = 0, l = blocks.length; i < l; i++) {
      const block = blocks[i]!;
      this._scheduler.requestCallback(
        async () => {
          try {
            const pipeline = createUpdatePipeline([block]);
            await this.flushUpdate(pipeline, host);
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

    pipeline.blocks = [];
  }

  private _scheduleEffects(
    pipeline: UpdatePipeline<TContext>,
    host: UpdateRuntime<TContext>,
  ): void {
    const { passiveEffects, mutationEffects, layoutEffects } = pipeline;

    if (mutationEffects.length > 0 || layoutEffects.length > 0) {
      this._scheduler.requestCallback(
        () => {
          try {
            host.flushEffects(mutationEffects, CommitPhase.Mutation);
            host.flushEffects(layoutEffects, CommitPhase.Layout);
          } finally {
            this._taskCount.value--;
          }
        },
        { priority: 'user-blocking' },
      );

      pipeline.mutationEffects = [];
      pipeline.layoutEffects = [];

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

      pipeline.passiveEffects = [];

      this._taskCount.value++;
    }
  }
}
