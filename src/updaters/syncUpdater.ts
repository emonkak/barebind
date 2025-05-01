import {
  CommitPhase,
  RenderFlag,
  type RenderFrame,
  type RenderHost,
  UpdateContext,
  type Updater,
} from '../baseTypes.js';
import { Atom } from '../directives/signal.js';

export class SyncUpdater<TContext> implements Updater<TContext> {
  private readonly _pendingTasks: Atom<number> = new Atom(0);

  flushUpdate(frame: RenderFrame<TContext>, host: RenderHost<TContext>): void {
    const { blocks, mutationEffects, layoutEffects, passiveEffects } = frame;

    frame.flags |= RenderFlag.InProgress;

    try {
      // block.length may be grow.
      for (let i = 0, l = blocks.length; i < l; l = blocks.length) {
        do {
          const block = blocks[i]!;
          if (!block.shouldUpdate()) {
            block.cancelUpdate();
            continue;
          }
          const context = new UpdateContext(host, this, block, frame);
          block.update(context);
        } while (++i < l);
      }
    } finally {
      frame.blocks.length = 0;
      frame.flags &= ~RenderFlag.InProgress;
    }

    if (mutationEffects.length > 0) {
      host.flushEffects(mutationEffects, CommitPhase.Mutation);
      frame.mutationEffects.length = 0;
    }

    if (layoutEffects.length > 0) {
      host.flushEffects(layoutEffects, CommitPhase.Layout);
      frame.layoutEffects.length = 0;
    }

    if (passiveEffects.length > 0) {
      host.flushEffects(passiveEffects, CommitPhase.Passive);
      frame.passiveEffects.length = 0;
    }

    frame.flags &= ~RenderFlag.ViewTransition;
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
    queueMicrotask(() => {
      const shouldStartViewTransition =
        (frame.flags & RenderFlag.ViewTransition) !== 0;
      try {
        if (shouldStartViewTransition) {
          host.startViewTransition(() => {
            this.flushUpdate(frame, host);
          });
        } else {
          this.flushUpdate(frame, host);
        }
      } finally {
        this._pendingTasks.value--;
      }
    });
    this._pendingTasks.value++;
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
}
