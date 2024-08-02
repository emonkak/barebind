import {
  EffectPhase,
  UpdateContext,
  type UpdateHost,
  type UpdatePipeline,
  type Updater,
} from '../baseTypes.js';

export class SyncUpdater<TContext> implements Updater<TContext> {
  private readonly _pendingPipelines: UpdatePipeline<TContext>[] = [];

  flushUpdate(
    pipeline: UpdatePipeline<TContext>,
    host: UpdateHost<TContext>,
  ): void {
    const { blocks, mutationEffects, layoutEffects, passiveEffects } = pipeline;

    // block.length may be grow.
    for (let i = 0, l = blocks.length; i < l; l = blocks.length) {
      do {
        const block = blocks[i]!;
        if (!block.shouldUpdate()) {
          block.cancelUpdate();
          continue;
        }
        const context = new UpdateContext(host, this, block, pipeline);
        block.update(context);
      } while (++i < l);
    }

    if (blocks.length > 0) {
      pipeline.blocks = [];
    }

    if (mutationEffects.length > 0) {
      host.flushEffects(mutationEffects, EffectPhase.Mutation);
      pipeline.mutationEffects = [];
    }

    if (layoutEffects.length > 0) {
      host.flushEffects(layoutEffects, EffectPhase.Layout);
      pipeline.layoutEffects = [];
    }

    if (passiveEffects.length > 0) {
      host.flushEffects(passiveEffects, EffectPhase.Passive);
      pipeline.passiveEffects = [];
    }
  }

  isScheduled(): boolean {
    return this._pendingPipelines.length > 0;
  }

  scheduleUpdate(
    pipeline: UpdatePipeline<TContext>,
    host: UpdateHost<TContext>,
  ): void {
    if (this._pendingPipelines.length === 0) {
      queueMicrotask(() => {
        for (let i = 0, l = this._pendingPipelines.length; i < l; i++) {
          this.flushUpdate(this._pendingPipelines[i]!, host);
        }
        this._pendingPipelines.length = 0;
      });
    }
    this._pendingPipelines.push(pipeline);
  }

  waitForUpdate(): Promise<void> {
    return this._pendingPipelines.length > 0
      ? new Promise(queueMicrotask)
      : Promise.resolve();
  }
}
