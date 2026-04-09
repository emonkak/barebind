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
import {
  getHighestPriorityLane,
  getRenderLanes,
  NoLanes,
  SyncLane,
  ViewTransitionLane,
} from './lane.js';
import { PriorityQueue } from './queue.js';

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
  private _currentUpdate: Update | undefined;
  private _updateQueue: PriorityQueue<Update> = new PriorityQueue(
    compareUpdates,
  );
  private _pendingLanes: number = NoLanes;
  private _flushLanes: number = NoLanes;
  private _transitionCount: number = 0;
  private _updateCount: number = 0;

  constructor(adapter: HostAdapter<TPart, TRenderer>) {
    this._adapter = adapter;
  }

  get adapter(): HostAdapter<TPart, TRenderer> {
    return this._adapter;
  }

  get currentUpdate(): Update | undefined {
    return this._currentUpdate;
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

    this._updateQueue.enqueue({
      id,
      lanes,
      task,
      controller,
    });

    if (
      (this._pendingLanes & lanes) !== lanes ||
      (this._flushLanes & lanes) !== lanes
    ) {
      this._adapter.requestCallback(() => {
        this._pendingLanes &= ~lanes;
        this._flushLanes |= lanes;
        if (this._currentUpdate === undefined) {
          this._flushUpdates();
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

  private async _flushUpdates(): Promise<void> {
    while ((this._currentUpdate = this._updateQueue.peek()) !== undefined) {
      const { controller, task, id, lanes } = this._currentUpdate;

      if ((this._flushLanes & lanes) === NoLanes) {
        this._currentUpdate = undefined;
        break;
      }

      this._updateQueue.dequeue();

      if ((task.pendingLanes & lanes) === NoLanes) {
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
          controller.resolve({ status: 'intrupted', reason: error.cause });
        } else {
          controller.reject(error);
        }
      }
    }
  }

  private async _runCommitAsync(
    session: Session<TPart, TRenderer>,
  ): Promise<void> {
    const { id, commitPhases, lanes } = session;
    const mutationEffects = session.mutationEffects.splice(0);
    const layoutEffects = session.layoutEffects.splice(0);
    const passiveEffects = session.passiveEffects.splice(0);

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

      if (lanes & ViewTransitionLane) {
        await this._adapter.startViewTransition(callback);
      } else {
        await this._adapter.requestCallback(callback, {
          priority: 'user-blocking',
        });
      }
    }

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

  private _runCommitSync(session: Session<TPart, TRenderer>): void {
    const { id, commitPhases } = session;
    const mutationEffects = session.mutationEffects.splice(0);
    const layoutEffects = session.layoutEffects.splice(0);
    const passiveEffects = session.passiveEffects.splice(0);

    if (commitPhases & MutationPhase && mutationEffects.length > 0) {
      this._flushEffects(id, mutationEffects, MutationPhase);
    }

    if (commitPhases & LayoutPhase && layoutEffects.length > 0) {
      this._flushEffects(id, layoutEffects, LayoutPhase);
    }

    if (commitPhases & PassivePhase && passiveEffects.length > 0) {
      this._flushEffects(id, passiveEffects, PassivePhase);
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

function compareUpdates(x: Update, y: Update): number {
  const p1 = getHighestPriorityLane(x.lanes);
  const p2 = getHighestPriorityLane(x.lanes);
  return p1 !== p2 ? p1 - p2 : x.task.scope.level - y.task.scope.level;
}

function notifyObservers(
  observers: Set<SessionObserver>,
  event: SessionEvent,
): void {
  for (const observer of observers) {
    observer.onSessionEvent(event);
  }
}
