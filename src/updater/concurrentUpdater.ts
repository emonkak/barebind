import { Atom } from '../directives/signal.js';
import { type Scheduler, getDefaultScheduler } from '../scheduler.js';
import {
  type Block,
  type Effect,
  EffectPhase,
  type UpdateHost,
  type Updater,
} from '../types.js';

export interface ConcurrentUpdaterOptions {
  scheduler?: Scheduler;
  taskCount?: Atom<number>;
}

interface Pipeline<TContext> {
  blocks: Block<TContext>[];
  mutationEffects: Effect[];
  layoutEffects: Effect[];
  passiveEffects: Effect[];
}

export class ConcurrentUpdater<TContext> implements Updater<TContext> {
  private readonly _host: UpdateHost<TContext>;

  private readonly _scheduler: Scheduler;

  private readonly _taskCount = new Atom(0);

  private _currentBlock: Block<TContext> | null = null;

  private _currentPipeline: Pipeline<TContext> = createPipeline([], [], [], []);

  constructor(
    host: UpdateHost<TContext>,
    {
      scheduler = getDefaultScheduler(),
      taskCount = new Atom(0),
    }: ConcurrentUpdaterOptions = {},
  ) {
    this._host = host;
    this._scheduler = scheduler;
    this._taskCount = taskCount;
  }

  getCurrentBlock(): Block<TContext> | null {
    return this._currentBlock;
  }

  getCurrentPriority(): TaskPriority {
    const currentEvent = window.event;
    if (currentEvent !== undefined) {
      return isContinuousEvent(currentEvent) ? 'user-visible' : 'user-blocking';
    } else {
      return 'user-visible';
    }
  }

  enqueueBlock(block: Block<TContext>): void {
    this._currentPipeline.blocks.push(block);
  }

  enqueueLayoutEffect(effect: Effect): void {
    this._currentPipeline.layoutEffects.push(effect);
  }

  enqueueMutationEffect(effect: Effect): void {
    this._currentPipeline.mutationEffects.push(effect);
  }

  enqueuePassiveEffect(effect: Effect): void {
    this._currentPipeline.passiveEffects.push(effect);
  }

  isPending(): boolean {
    return (
      this._taskCount.value > 0 ||
      this._currentPipeline.blocks.length > 0 ||
      this._currentPipeline.layoutEffects.length > 0 ||
      this._currentPipeline.mutationEffects.length > 0 ||
      this._currentPipeline.passiveEffects.length > 0
    );
  }

  isScheduled(): boolean {
    return this._taskCount.value > 0;
  }

  scheduleUpdate(): void {
    if (this._currentBlock !== null) {
      return;
    }
    this._scheduleBlocks(this._currentPipeline);
    this._scheduleBlockingEffects(this._currentPipeline);
    this._schedulePassiveEffects(this._currentPipeline);
    this._currentPipeline = createPipeline([], [], [], []);
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

  private async _beginUpdate(block: Block<TContext>): Promise<void> {
    const pipeline = createPipeline([block], [], [], []);
    const pendingBlocks = pipeline.blocks;
    const originalPipeline = this._currentPipeline;

    let startTime = this._scheduler.getCurrentTime();

    // Do not reuse pendingBlock.length since it can grow.
    for (let i = 0; i < pendingBlocks.length; i++) {
      const pendingBlock = pendingBlocks[i]!;
      if (!pendingBlock.shouldUpdate()) {
        pendingBlock.cancelUpdate();
        continue;
      }

      if (
        this._scheduler.shouldYieldToMain(
          this._scheduler.getCurrentTime() - startTime,
        )
      ) {
        await this._scheduler.yieldToMain({
          priority: pendingBlock.priority,
        });
        startTime = this._scheduler.getCurrentTime();
      }

      this._currentBlock = pendingBlock;
      this._currentPipeline = pipeline;
      try {
        pendingBlock.performUpdate(this._host, this);
      } finally {
        this._currentBlock = null;
        this._currentPipeline = originalPipeline;
      }
    }

    this._scheduleBlockingEffects(pipeline);
    this._schedulePassiveEffects(pipeline);
  }

  private _scheduleBlocks(pipeline: Pipeline<TContext>): void {
    for (let i = 0, l = pipeline.blocks.length; i < l; i++) {
      const block = pipeline.blocks[i]!;
      this._scheduler.requestCallback(
        async () => {
          try {
            await this._beginUpdate(block);
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

  private _scheduleBlockingEffects(pipeline: Pipeline<TContext>): void {
    if (
      pipeline.mutationEffects.length > 0 ||
      pipeline.layoutEffects.length > 0
    ) {
      this._scheduler.requestCallback(
        () => {
          try {
            this._host.flushEffects(
              pipeline.mutationEffects,
              EffectPhase.Mutation,
            );
            this._host.flushEffects(pipeline.layoutEffects, EffectPhase.Layout);
          } finally {
            this._taskCount.value--;
          }
        },
        { priority: 'user-blocking' },
      );
      this._taskCount.value++;
    }
  }

  private _schedulePassiveEffects(pipeline: Pipeline<TContext>): void {
    if (pipeline.passiveEffects.length > 0) {
      this._scheduler.requestCallback(
        () => {
          try {
            this._host.flushEffects(
              pipeline.passiveEffects,
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

function createPipeline<TContext>(
  blocks: Block<TContext>[],
  mutationEffects: Effect[],
  layoutEffects: Effect[],
  passiveEffects: [],
): Pipeline<TContext> {
  return {
    blocks,
    mutationEffects,
    layoutEffects,
    passiveEffects,
  };
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
