import type { Effect, Hook } from './core.js';

export class CleanupEffectHook implements Effect {
  private readonly _hook: Hook.EffectHook;

  private readonly _epoch: number;

  constructor(hook: Hook.EffectHook) {
    this._hook = hook;
    this._epoch = hook.epoch;
  }

  commit(): void {
    const { cleanup, epoch } = this._hook;

    if (epoch === this._epoch) {
      cleanup?.();
      this._hook.cleanup = undefined;
      this._hook.memoizedDependencies = null;
    }
  }
}

export class InvokeEffectHook implements Effect {
  private readonly _hook: Hook.EffectHook;

  private readonly _epoch: number;

  constructor(hook: Hook.EffectHook) {
    this._hook = hook;
    this._epoch = hook.epoch;
  }

  commit(): void {
    const { cleanup, epoch, pendingDependencies, setup } = this._hook;

    if (epoch === this._epoch) {
      cleanup?.();
      this._hook.cleanup = setup();
      this._hook.memoizedDependencies = pendingDependencies;
    }
  }
}
