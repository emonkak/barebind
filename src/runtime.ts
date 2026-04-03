/// <reference path="../typings/upsert.d.ts" />

import {
  type Effect,
  type EffectPhase,
  type EffectPhases,
  type HostAdapter,
  type Lanes,
  LayoutPhase,
  MutationPhase,
  PassivePhase,
  type Session,
  type Update,
  type UpdateHandle,
  type UpdateOptions,
  type UpdateResult,
  type UpdateScheduler,
  type UpdateTask,
  type UpdateUnit,
} from './core.js';
import { InterruptError } from './error.js';
import { getRenderLanes, SyncLane, ViewTransitionLane } from './lane.js';
import { Queue } from './queue.js';
import { getPendingAncestor } from './scope.js';

export type SessionEvent =
  | {
      type: 'render-start' | 'render-end';
      id: number;
      lanes: Lanes;
    }
  | {
      type: 'render-error';
      id: number;
      error: unknown;
      captured: boolean;
    }
  | {
      type: 'slot-render-start' | 'slot-render-end';
      id: number;
      slot: UpdateUnit;
    }
  | {
      type: 'commit-start' | 'commit-end';
      id: number;
    }
  | {
      type: 'commit-abort';
      id: number;
      reason: unknown;
    }
  | {
      type: 'effect-commit-start' | 'effect-commit-end';
      id: number;
      phase: EffectPhase;
      effects: Effect[];
    };

export interface SessionObserver {
  onSessionEvent(event: SessionEvent): void;
}

export class Runtime<TPart = unknown, TRenderer = unknown>
  implements UpdateScheduler<TPart, TRenderer>
{
  private readonly _adapter: HostAdapter<TPart, TRenderer>;

  private readonly _observers: Set<SessionObserver> = new Set();

  private readonly _updateQueue: Queue<Update<TPart, TRenderer>> = new Queue();

  private _transitionCount: number = 0;

  private _updateCount: number = 0;

  constructor(adapter: HostAdapter<TPart, TRenderer>) {
    this._adapter = adapter;
  }

  get adapter(): HostAdapter<TPart, TRenderer> {
    return this._adapter;
  }

  get updateQueue(): Queue<Update<TPart, TRenderer>> {
    return this._updateQueue;
  }

  async flush(): Promise<void> {
    for (
      let update: Update<TPart, TRenderer> | undefined;
      (update = this._updateQueue.peek()) !== undefined;
      this._updateQueue.dequeue()
    ) {
      const { controller, task, id, lanes } = update;

      if (
        (task.pendingLanes & lanes) === 0 ||
        getPendingAncestor(task.scope, lanes) !== null
      ) {
        controller.resolve({ status: 'skipped' });
        continue;
      }

      const session: Session<TPart, TRenderer> = {
        id,
        lanes,
        mutationEffects: [],
        layoutEffects: [],
        passiveEffects: [],
        adapter: this._adapter,
        renderer: this._adapter.requestRenderer(task.scope),
        scheduler: this,
      };
      const phases = this._adapter.getCommitPhases();

      try {
        notifyObservers(this._observers, {
          type: 'render-start',
          id,
          lanes,
        });

        if (lanes & SyncLane) {
          this._runRenderSync(task.start(session), session);
        } else {
          await this._runRenderAsync(task.start(session), session);
        }

        notifyObservers(this._observers, {
          type: 'render-end',
          id,
          lanes,
        });

        notifyObservers(this._observers, {
          type: 'commit-start',
          id,
        });

        if (lanes & SyncLane) {
          this._runCommitSync(session, phases);
        } else {
          await this._runCommitAsync(session, phases);
        }

        this._completeCommit(session, phases);

        controller.resolve({ status: 'done' });
      } catch (error) {
        session.mutationEffects.length = 0;
        session.layoutEffects.length = 0;
        session.passiveEffects.length = 0;

        notifyObservers(this._observers, {
          type: 'commit-abort',
          id,
          reason: error,
        });

        if (error instanceof InterruptError) {
          controller.resolve({ status: 'aborted', reason: error.cause });
        } else {
          controller.reject(error);
        }
      }
    }
  }

  nextTransition(): number {
    return this._transitionCount++;
  }

  observe(observer: SessionObserver): () => void {
    const observers = this._observers;
    observers.add(observer);
    return () => {
      observers.delete(observer);
    };
  }

  schedule(
    task: UpdateTask<TPart, TRenderer>,
    options: UpdateOptions = {},
  ): UpdateHandle {
    options.priority ??=
      options.transition !== undefined
        ? 'background'
        : this._adapter.getTaskPriority();

    const controller = Promise.withResolvers<UpdateResult>();
    const id = this._updateCount++;
    const lanes = this._adapter.getDefaultLanes() | getRenderLanes(options);
    const callback = (): UpdateResult => {
      const needsFlush =
        (options.triggerFlush ?? true) &&
        this._updateQueue.peek() === undefined;

      this._updateQueue.enqueue({
        id,
        lanes,
        task,
        controller,
      });

      if (needsFlush) {
        scheduled.then(() => {
          this.flush();
        });
      }

      return { status: 'done' };
    };
    let scheduled: Promise<UpdateResult>;

    if (options.immediate) {
      const { promise, resolve } = Promise.withResolvers<UpdateResult>();
      scheduled = promise;
      resolve(callback());
    } else {
      scheduled = this._adapter
        .requestCallback(callback, options)
        .catch((error) => {
          // callback() is guaranteed not to throw anything; rejection here only
          // indicates AbortSignal cancellation.
          const canceled: UpdateResult = { status: 'aborted', reason: error };
          controller.resolve(canceled);
          return canceled;
        });
    }

    return {
      id,
      lanes,
      scheduled,
      finished: controller.promise,
    };
  }

  private _completeCommit(
    session: Session<TPart, TRenderer>,
    phases: EffectPhases,
  ): void {
    const { id, passiveEffects } = session;

    if (phases & PassivePhase && passiveEffects.length > 0) {
      this._adapter
        .requestCallback(
          () => {
            this._flushEffects(id, passiveEffects, PassivePhase);
          },
          { priority: 'background' },
        )
        .finally(() => {
          notifyObservers(this._observers, {
            type: 'commit-end',
            id,
          });
        });
    } else {
      notifyObservers(this._observers, {
        type: 'commit-end',
        id,
      });
    }
  }

  private _flushEffects(
    id: number,
    effects: Effect[],
    phase: EffectPhase,
  ): void {
    notifyObservers(this._observers, {
      type: 'effect-commit-start',
      id,
      phase,
      effects,
    });

    for (const effect of effects.splice(0)) {
      effect.commit();
    }

    notifyObservers(this._observers, {
      type: 'effect-commit-end',
      id,
      phase,
      effects,
    });
  }

  private async _runCommitAsync(
    session: Session<TPart, TRenderer>,
    phases: EffectPhases,
  ): Promise<void> {
    const { id, layoutEffects, mutationEffects } = session;

    if (
      phases & (MutationPhase | LayoutPhase) &&
      (mutationEffects.length > 0 || layoutEffects.length > 0)
    ) {
      const callback = () => {
        if (phases & MutationPhase && mutationEffects.length > 0) {
          this._flushEffects(id, mutationEffects, MutationPhase);
        }

        if (phases & LayoutPhase && layoutEffects.length > 0) {
          this._flushEffects(id, layoutEffects, LayoutPhase);
        }
      };

      if (session.lanes & ViewTransitionLane) {
        await this._adapter.startViewTransition(callback);
      } else {
        await this._adapter.requestCallback(callback, {
          priority: 'user-blocking',
        });
      }
    }
  }

  private _runCommitSync(
    session: Session<TPart, TRenderer>,
    phases: EffectPhases,
  ): void {
    const { id, layoutEffects, mutationEffects } = session;

    if (phases & MutationPhase && mutationEffects.length > 0) {
      this._flushEffects(id, mutationEffects, MutationPhase);
    }

    if (phases & LayoutPhase && layoutEffects.length > 0) {
      this._flushEffects(id, layoutEffects, LayoutPhase);
    }
  }

  private async _runRenderAsync(
    renerLoop: Iterable<UpdateUnit>,
    session: Session<TPart, TRenderer>,
    lastLevel: number = 0,
  ): Promise<number> {
    const { id } = session;

    for (const slot of renerLoop) {
      const currentLevel = slot.scope.level;

      if (currentLevel < lastLevel) {
        await this._adapter.yieldToMain();
      }

      notifyObservers(this._observers, {
        type: 'slot-render-start',
        id,
        slot,
      });

      lastLevel = await this._runRenderAsync(
        slot.render(session),
        session,
        currentLevel,
      );

      notifyObservers(this._observers, {
        type: 'slot-render-end',
        id,
        slot,
      });
    }

    return lastLevel;
  }

  private _runRenderSync(
    renderLoop: Iterable<UpdateUnit>,
    session: Session<TPart, TRenderer>,
  ): void {
    const { id } = session;

    for (const slot of renderLoop) {
      notifyObservers(this._observers, {
        type: 'slot-render-start',
        id,
        slot,
      });

      this._runRenderSync(slot.render(session), session);

      notifyObservers(this._observers, {
        type: 'slot-render-end',
        id,
        slot,
      });
    }
  }
}

function notifyObservers(
  observers: Set<SessionObserver>,
  event: SessionEvent,
): void {
  for (const observer of observers) {
    observer.onSessionEvent(event);
  }
}
