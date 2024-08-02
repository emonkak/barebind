import {
  type Block,
  type Effect,
  EffectPhase,
  type UpdateHost,
  type Updater,
} from '../baseTypes.js';
import { Atom } from '../directives/signal.js';
import { type Scheduler, getDefaultScheduler } from '../scheduler.js';

export interface ConcurrentUpdaterOptions {
  scheduler?: Scheduler;
}

interface UpdatePipeline<TContext> {
  blocks: Block<TContext>[];
  mutationEffects: Effect[];
  layoutEffects: Effect[];
  passiveEffects: Effect[];
}

export class ConcurrentUpdater<TContext> implements Updater<TContext> {
  private readonly _scheduler: Scheduler;

  private readonly _taskCount: Atom<number> = new Atom(0);

  private _pipeline: UpdatePipeline<TContext> = createPipeline([], [], [], []);

  private _isUpdating = false;

  constructor({
    scheduler = getDefaultScheduler(),
  }: ConcurrentUpdaterOptions = {}) {
    this._scheduler = scheduler;
  }

  enqueueBlock(block: Block<TContext>): void {
    this._pipeline.blocks.push(block);
  }

  enqueueLayoutEffect(effect: Effect): void {
    this._pipeline.layoutEffects.push(effect);
  }

  enqueueMutationEffect(effect: Effect): void {
    this._pipeline.mutationEffects.push(effect);
  }

  enqueuePassiveEffect(effect: Effect): void {
    this._pipeline.passiveEffects.push(effect);
  }

  isPending(): boolean {
    return (
      this._pipeline.blocks.length > 0 ||
      this._pipeline.mutationEffects.length > 0 ||
      this._pipeline.layoutEffects.length > 0 ||
      this._pipeline.passiveEffects.length > 0
    );
  }

  isScheduled(): boolean {
    return this._taskCount.value > 0;
  }

  scheduleUpdate(host: UpdateHost<TContext>): void {
    if (this._isUpdating) {
      return;
    }
    const pipeline = this._pipeline;
    this._pipeline = createPipeline([], [], [], []);
    this._scheduleBlocks(pipeline, host);
    this._scheduleBlockingEffects(pipeline, host);
    this._schedulePassiveEffects(pipeline, host);
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

  private async _beginUpdate(
    rootBlock: Block<TContext>,
    host: UpdateHost<TContext>,
  ): Promise<void> {
    const originalPipeline = this._pipeline;
    const pipeline = createPipeline([rootBlock], [], [], []);
    const blocks = pipeline.blocks;

    let startTime = this._scheduler.getCurrentTime();

    // Do not remember block.length since it can grow.
    for (let i = 0; i < blocks.length; i++) {
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

      this._pipeline = pipeline;
      this._isUpdating = true;
      try {
        block.update(host, this);
      } finally {
        this._isUpdating = false;
        this._pipeline = originalPipeline;
      }
    }

    this._scheduleBlockingEffects(pipeline, host);
    this._schedulePassiveEffects(pipeline, host);
  }

  private _scheduleBlocks(
    pipeline: UpdatePipeline<TContext>,
    host: UpdateHost<TContext>,
  ): void {
    for (let i = 0, l = pipeline.blocks.length; i < l; i++) {
      const block = pipeline.blocks[i]!;
      this._scheduler.requestCallback(
        async () => {
          try {
            await this._beginUpdate(block, host);
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
  }

  private _scheduleBlockingEffects(
    pipeline: UpdatePipeline<TContext>,
    host: UpdateHost<TContext>,
  ): void {
    if (
      pipeline.mutationEffects.length > 0 ||
      pipeline.layoutEffects.length > 0
    ) {
      this._scheduler.requestCallback(
        () => {
          try {
            host.flushEffects(pipeline.mutationEffects, EffectPhase.Mutation);
            host.flushEffects(pipeline.layoutEffects, EffectPhase.Layout);
          } finally {
            this._taskCount.value--;
          }
        },
        { priority: 'user-blocking' },
      );
      this._taskCount.value++;
    }
  }

  private _schedulePassiveEffects(
    pipeline: UpdatePipeline<TContext>,
    host: UpdateHost<TContext>,
  ): void {
    if (pipeline.passiveEffects.length > 0) {
      this._scheduler.requestCallback(
        () => {
          try {
            host.flushEffects(pipeline.passiveEffects, EffectPhase.Passive);
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

function createPipeline<TContext>(
  blocks: Block<TContext>[],
  mutationEffects: Effect[],
  layoutEffects: Effect[],
  passiveEffects: [],
): UpdatePipeline<TContext> {
  return {
    blocks,
    mutationEffects,
    layoutEffects,
    passiveEffects,
  };
}
