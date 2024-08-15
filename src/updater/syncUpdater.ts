import {
  CommitPhase,
  UpdateContext,
  type UpdateQueue,
  type UpdateRuntime,
  type Updater,
} from '../baseTypes.js';

export class SyncUpdater<TContext> implements Updater<TContext> {
  private readonly _pendingPipelines: UpdateQueue<TContext>[] = [];

  flushUpdate(
    queue: UpdateQueue<TContext>,
    host: UpdateRuntime<TContext>,
  ): void {
    const { blocks, mutationEffects, layoutEffects, passiveEffects } = queue;

    try {
      // block.length may be grow.
      for (let i = 0, l = blocks.length; i < l; l = blocks.length) {
        do {
          const block = blocks[i]!;
          if (!block.shouldUpdate()) {
            block.cancelUpdate();
            continue;
          }
          const context = new UpdateContext(host, this, block, queue);
          block.update(context);
        } while (++i < l);
      }
    } finally {
      queue.blocks.length = 0;
    }

    if (mutationEffects.length > 0) {
      host.flushEffects(mutationEffects, CommitPhase.Mutation);
      queue.mutationEffects.length = 0;
    }

    if (layoutEffects.length > 0) {
      host.flushEffects(layoutEffects, CommitPhase.Layout);
      queue.layoutEffects.length = 0;
    }

    if (passiveEffects.length > 0) {
      host.flushEffects(passiveEffects, CommitPhase.Passive);
      queue.passiveEffects.length = 0;
    }
  }

  isScheduled(): boolean {
    return this._pendingPipelines.length > 0;
  }

  scheduleUpdate(
    queue: UpdateQueue<TContext>,
    host: UpdateRuntime<TContext>,
  ): void {
    if (this._pendingPipelines.length === 0) {
      queueMicrotask(() => {
        for (let i = 0, l = this._pendingPipelines.length; i < l; i++) {
          this.flushUpdate(this._pendingPipelines[i]!, host);
        }
        this._pendingPipelines.length = 0;
      });
    }
    this._pendingPipelines.push(queue);
  }

  waitForUpdate(): Promise<void> {
    return this._pendingPipelines.length > 0
      ? new Promise(queueMicrotask)
      : Promise.resolve();
  }
}
