/// <reference path="../typings/upsert.d.ts" />

import {
  type CommitPhase,
  type Effect,
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
      type: 'unit-render-start' | 'unit-render-end';
      id: number;
      unit: UpdateUnit;
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
      phase: CommitPhase;
      effects: Effect[];
    };

export interface SessionObserver {
  onSessionEvent(event: SessionEvent): void;
}

export class Runtime<TPart = unknown, TRenderer = unknown>
  implements UpdateScheduler
{
  private readonly _adapter: HostAdapter<TPart, TRenderer>;
  private readonly _observers: Set<SessionObserver> = new Set();
  private _currentQueue: Queue<Update> = new Queue();
  private _alternateQueue: Queue<Update> = new Queue();
  private _flushLanes: number = 0;
  private _pendingLanes: number = 0;
  private _transitionCount: number = 0;
  private _updateCount: number = 0;

  constructor(adapter: HostAdapter<TPart, TRenderer>) {
    this._adapter = adapter;
  }

  get adapter(): HostAdapter<TPart, TRenderer> {
    return this._adapter;
  }

  *getPendingUpdates(): Iterable<Update> {
    yield* this._currentQueue;
    yield* this._alternateQueue;
  }

  async flush(): Promise<void> {
    while (true) {
      const currentQueue = this._currentQueue;
      const alternateQueue = this._alternateQueue;
      const flushLanes = this._flushLanes;

      for (
        let update: Update | undefined;
        (update = currentQueue.peek()) !== undefined;
        currentQueue.dequeue()
      ) {
        const { controller, task, id, lanes } = update;

        if ((lanes & flushLanes) !== lanes) {
          alternateQueue.enqueue(update);
          continue;
        }

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
          commitPhases: this._adapter.getCommitPhases(),
          mutationEffects: [],
          layoutEffects: [],
          passiveEffects: [],
          adapter: this._adapter,
          renderer: this._adapter.requestRenderer(task.scope),
          scheduler: this,
        };

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
            this._runCommitSync(session);
          } else {
            await this._runCommitAsync(session);
          }

          this._completeCommit(session);

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

      this._currentQueue = alternateQueue;
      this._alternateQueue = currentQueue;

      if (this._flushLanes === flushLanes) {
        this._flushLanes = 0;
        break;
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

  schedule(task: UpdateTask, options: UpdateOptions = {}): UpdateHandle {
    options.priority ??=
      options.transition !== undefined || options.delay !== undefined
        ? 'background'
        : options.flushSync
          ? 'user-blocking'
          : this._adapter.getTaskPriority();

    const controller = Promise.withResolvers<UpdateResult>();
    const id = this._updateCount++;
    const lanes = this._adapter.getDefaultLanes() | getRenderLanes(options);

    this._currentQueue.enqueue({
      id,
      lanes,
      task,
      controller,
    });

    if (
      (this._pendingLanes & lanes) !== lanes &&
      (this._flushLanes & lanes) !== lanes
    ) {
      this._adapter.requestCallback(() => {
        const needsFlush = this._flushLanes === 0;
        this._flushLanes |= lanes;
        this._pendingLanes &= ~lanes;
        if (needsFlush) {
          this.flush();
        }
      }, options);
      this._pendingLanes |= lanes;
    }

    return {
      id,
      lanes,
      finished: controller.promise,
    };
  }

  private _completeCommit(session: Session<TPart, TRenderer>): void {
    const { id, commitPhases } = session;
    const passiveEffects = session.passiveEffects.splice(0);

    if (commitPhases & PassivePhase && passiveEffects.length > 0) {
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
    phase: CommitPhase,
  ): void {
    notifyObservers(this._observers, {
      type: 'effect-commit-start',
      id,
      phase,
      effects,
    });

    for (const effect of effects) {
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
  ): Promise<void> {
    const { id, commitPhases } = session;
    const mutationEffects = session.mutationEffects.splice(0);
    const layoutEffects = session.layoutEffects.splice(0);

    if (
      commitPhases & (MutationPhase | LayoutPhase) &&
      (mutationEffects.length > 0 || layoutEffects.length > 0)
    ) {
      const callback = () => {
        if (commitPhases & MutationPhase && mutationEffects.length > 0) {
          this._flushEffects(id, mutationEffects, MutationPhase);
        }

        if (commitPhases & LayoutPhase && layoutEffects.length > 0) {
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

  private _runCommitSync(session: Session<TPart, TRenderer>): void {
    const { id, commitPhases } = session;
    const mutationEffects = session.mutationEffects.splice(0);
    const layoutEffects = session.layoutEffects.splice(0);

    if (commitPhases & MutationPhase && mutationEffects.length > 0) {
      this._flushEffects(id, mutationEffects, MutationPhase);
    }

    if (commitPhases & LayoutPhase && layoutEffects.length > 0) {
      this._flushEffects(id, layoutEffects, LayoutPhase);
    }
  }

  private async _runRenderAsync(
    renerLoop: Iterable<UpdateUnit>,
    session: Session<TPart, TRenderer>,
    lastLevel: number = 0,
  ): Promise<number> {
    const { id } = session;

    for (const unit of renerLoop) {
      const level = unit.scope.level;

      if (level < lastLevel) {
        await this._adapter.yieldToMain();
      }

      notifyObservers(this._observers, {
        type: 'unit-render-start',
        id,
        unit,
      });

      lastLevel = await this._runRenderAsync(
        unit.render(session),
        session,
        level,
      );

      notifyObservers(this._observers, {
        type: 'unit-render-end',
        id,
        unit,
      });
    }

    return lastLevel;
  }

  private _runRenderSync(
    renderLoop: Iterable<UpdateUnit>,
    session: Session<TPart, TRenderer>,
  ): void {
    const { id } = session;

    for (const unit of renderLoop) {
      notifyObservers(this._observers, {
        type: 'unit-render-start',
        id,
        unit,
      });

      this._runRenderSync(unit.render(session), session);

      notifyObservers(this._observers, {
        type: 'unit-render-end',
        id,
        unit,
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
