import {
  type Block,
  type Effect,
  EffectPhase,
  type UpdateHost,
  type Updater,
} from '../types.js';

export class SyncUpdater<TContext> implements Updater<TContext> {
  private _pendingBlocks: Block<TContext>[] = [];

  private _pendingMutationEffects: Effect[] = [];

  private _pendingLayoutEffects: Effect[] = [];

  private _pendingPassiveEffects: Effect[] = [];

  private _isScheduled = false;

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

  flushUpdate(host: UpdateHost<TContext>): void {
    const blocks = this._pendingBlocks;
    const mutationEffects = this._pendingMutationEffects;
    const layoutEffects = this._pendingLayoutEffects;
    const passiveEffects = this._pendingPassiveEffects;

    // Do not remember block.length since it can grow.
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]!;
      if (!block.shouldUpdate()) {
        block.cancelUpdate();
        continue;
      }
      block.update(host, this);
    }

    if (mutationEffects.length > 0) {
      host.flushEffects(mutationEffects, EffectPhase.Mutation);
    }

    if (layoutEffects.length > 0) {
      host.flushEffects(layoutEffects, EffectPhase.Layout);
    }

    if (passiveEffects.length > 0) {
      host.flushEffects(passiveEffects, EffectPhase.Passive);
    }

    this._pendingBlocks = [];
    this._pendingMutationEffects = [];
    this._pendingLayoutEffects = [];
    this._pendingPassiveEffects = [];
    this._isScheduled = false;
  }

  isPending(): boolean {
    return (
      this._pendingBlocks.length > 0 ||
      this._pendingMutationEffects.length > 0 ||
      this._pendingLayoutEffects.length > 0 ||
      this._pendingPassiveEffects.length > 0
    );
  }

  isScheduled(): boolean {
    return this._isScheduled;
  }

  scheduleUpdate(host: UpdateHost<TContext>): void {
    if (!this._isScheduled) {
      this._isScheduled = true;
      queueMicrotask(() => {
        this.flushUpdate(host);
      });
    }
  }

  waitForUpdate(): Promise<void> {
    return this._isScheduled ? new Promise(queueMicrotask) : Promise.resolve();
  }
}
