import {
  CommitPhase,
  type RenderHost,
  UpdateContext,
  type UpdateQueue,
  type Updater,
} from '../baseTypes.js';
import { State } from '../directives/signal.js';

export class SyncUpdater<TContext> implements Updater<TContext> {
  private readonly _pendingTasks: State<number> = new State(0);

  flushUpdate(queue: UpdateQueue<TContext>, host: RenderHost<TContext>): void {
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
    return this._pendingTasks.value > 0;
  }

  scheduleUpdate(
    queue: UpdateQueue<TContext>,
    host: RenderHost<TContext>,
  ): void {
    queueMicrotask(() => {
      try {
        this.flushUpdate(queue, host);
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
