/// <reference path="../typings/upsert.d.ts" />

import type {
  HostAdapter,
  Lanes,
  Session,
  Update,
  UpdateHandle,
  UpdateOptions,
  UpdateResult,
  UpdateScheduler,
  UpdateTask,
  UpdateUnit,
} from './core.js';
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
      type: 'commit-start' | 'commit-end';
      id: number;
    }
  | {
      type: 'commit-abort';
      id: number;
      reason: unknown;
    }
  | {
      type: 'unit-start' | 'unit-end';
      id: number;
      unit: UpdateUnit;
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
  private _identifierCount: number = 0;
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

  nextIdentifier(): string {
    return this._adapter.getIdentifier() + '-' + this._identifierCount++;
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
      (this._pendingLanes & lanes) !== lanes &&
      (this._flushLanes & lanes) !== lanes
    ) {
      this._adapter.requestCallback(() => {
        this._pendingLanes &= ~lanes;
        this._flushLanes |= lanes;
        if (this._currentUpdate === undefined) {
          this._flush();
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

  private async _flush(): Promise<void> {
    while ((this._currentUpdate = this._updateQueue.peek()) !== undefined) {
      const { controller, task, id, lanes } = this._currentUpdate;

      if ((this._flushLanes & lanes) !== lanes) {
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

        const loop = task.render(session);

        if (lanes & SyncLane) {
          this._renderSync(loop, session);
        } else {
          await this._renderAsync(loop, session);
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

        if (lanes & ViewTransitionLane) {
          await this._adapter.startViewTransition(() => {
            task.complete();
          });
        } else {
          task.complete();
        }

        notifyObservers(this._observers, {
          type: 'commit-end',
          id,
        });

        controller.resolve({ status: 'done' });
      } catch (error) {
        notifyObservers(this._observers, {
          type: 'commit-abort',
          id,
          reason: error,
        });

        controller.reject(error);
      }
    }
    this._flushLanes = NoLanes;
  }

  private async _renderAsync(
    loop: Iterable<UpdateUnit>,
    session: Session<TPart, TRenderer>,
    lastLevel: number = 0,
  ): Promise<number> {
    const { id } = session;

    for (const unit of loop) {
      const level = unit.scope.level;

      if (level < lastLevel) {
        await this._adapter.yieldToMain();
      }

      notifyObservers(this._observers, {
        type: 'unit-start',
        id,
        unit,
      });

      lastLevel = await this._renderAsync(unit.render(session), session, level);

      notifyObservers(this._observers, {
        type: 'unit-end',
        id,
        unit,
      });
    }

    return lastLevel;
  }

  private _renderSync(
    loop: Iterable<UpdateUnit>,
    session: Session<TPart, TRenderer>,
  ): void {
    const { id } = session;

    for (const unit of loop) {
      notifyObservers(this._observers, {
        type: 'unit-start',
        id,
        unit,
      });

      this._renderSync(unit.render(session), session);

      notifyObservers(this._observers, {
        type: 'unit-end',
        id,
        unit,
      });
    }
  }
}

function compareUpdates(x: Update, y: Update): number {
  const p1 = getHighestPriorityLane(x.lanes);
  const p2 = getHighestPriorityLane(y.lanes);
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
