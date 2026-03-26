/// <reference path="../typings/upsert.d.ts" />

import type { HostAdapter } from './adapter.js';
import { LinkedList } from './collections/linked-list.js';
import {
  type CommitPhase,
  type Coroutine,
  Directive,
  type DirectiveType,
  EffectQueue,
  type Lanes,
  Primitive,
  type RenderFrame,
  type Scope,
  type Session,
  type SessionContext,
  type SessionEvent,
  type SessionObserver,
  Template,
  toDirectiveNode,
  type UnwrapBindable,
  type Update,
  type UpdateHandle,
  type UpdateOptions,
  type UpdateResult,
} from './core.js';
import {
  AbortError,
  CoroutineError,
  handleError,
  InterruptError,
} from './error.js';
import {
  getSchedulingLanes,
  NoLanes,
  SyncLane,
  ViewTransitionLane,
} from './lane.js';

export interface RuntimeOptions {
  uniqueIdentifier?: string;
  maxCoroutinesPerYield?: number;
}

export class Runtime<TPart = unknown, TRenderer = unknown>
  implements SessionContext<TPart, TRenderer>
{
  private readonly _adapter: HostAdapter<TPart, TRenderer>;

  private readonly _cachedTemplates: WeakMap<
    readonly string[],
    DirectiveType<readonly unknown[]>
  > = new WeakMap();
  private readonly _maxCoroutinesPerYield: number;

  private readonly _observers: LinkedList<SessionObserver> = new LinkedList();

  private readonly _scheduledUpdates: LinkedList<Update<TPart, TRenderer>> =
    new LinkedList();

  private readonly _uniqueIdentifier: string;

  private _identifierCount: number = 0;

  private _transitionCount: number = 0;

  private _updateCount: number = 0;

  constructor(
    adapter: HostAdapter<TPart, TRenderer>,
    {
      maxCoroutinesPerYield = 64,
      uniqueIdentifier = generateUniqueIdentifier(8),
    }: RuntimeOptions = {},
  ) {
    this._adapter = adapter;
    this._maxCoroutinesPerYield = maxCoroutinesPerYield;
    this._uniqueIdentifier = uniqueIdentifier;
  }

  addObserver(observer: SessionObserver): () => void {
    const observers = this._observers;
    const node = observers.pushBack(observer);
    return () => {
      observers.remove(node);
    };
  }

  async flushUpdates(): Promise<void> {
    for (
      let update: Update<TPart, TRenderer> | undefined;
      (update = this._scheduledUpdates.front()?.value) !== undefined;
      this._scheduledUpdates.popFront()
    ) {
      const { controller, coroutine, id, lanes } = update;

      if (
        (coroutine.pendingLanes & lanes) === NoLanes ||
        coroutine.scope.getPendingAncestor(lanes) !== null
      ) {
        controller.resolve({ status: 'skipped' });
        continue;
      }

      const frame = createRenderFrame<TPart, TRenderer>(id, lanes);
      const session: Session<TPart, TRenderer> = {
        renderer: this._adapter.requestRenderer(coroutine.scope),
        frame,
        scope: coroutine.scope,
        coroutine,
        context: this,
      };

      try {
        coroutine.start(session);

        if (lanes & SyncLane) {
          this._runRenderSync(session);
          this._runCommitSync(frame);
        } else {
          await this._runRenderAsync(session);
          await this._runCommitAsync(frame, lanes);
        }

        controller.resolve({ status: 'done' });
      } catch (error) {
        resetRenderFrame(frame);

        if (error instanceof CoroutineError) {
          notifyObservers(this._observers, {
            type: 'commit-cancel',
            id,
            reason: error,
          });
        }

        if (error instanceof InterruptError) {
          controller.resolve({ status: 'canceled', reason: error.cause });
        } else {
          controller.reject(error);
        }
      }
    }
  }

  getScheduledUpdates(): Update<TPart, TRenderer>[] {
    return Array.from(this._scheduledUpdates);
  }

  nextIdentifier(): string {
    // The identifier is also valid as a view transition name.
    return this._uniqueIdentifier + '-' + this._identifierCount++;
  }

  resolveDirective<TSource, TBindingPart extends TPart>(
    source: TSource,
    part: TBindingPart,
  ): Directive.Element<UnwrapBindable<TSource>, TBindingPart, TRenderer> {
    const directive = toDirectiveNode(source);
    switch (directive.type) {
      case Primitive: {
        const { value, key } = directive;
        const type = this._adapter.resolvePrimitive(value, part);
        type.ensureValue?.(value, part);
        return new Directive(type, value, key) as Directive.Element<
          UnwrapBindable<TSource>,
          TBindingPart,
          TRenderer
        >;
      }
      case Template: {
        const { value, key } = directive;
        const { strings, exprs, mode } = value;
        const type = this._cachedTemplates.getOrInsertComputed(strings, () => {
          return this._adapter.resolveTemplate(
            strings,
            exprs,
            mode,
            this._uniqueIdentifier,
          );
        });
        return new Directive(type, exprs, key) as Directive.Element<
          UnwrapBindable<TSource>,
          TBindingPart,
          TRenderer
        >;
      }
      default:
        return directive as Directive.Element<
          UnwrapBindable<TSource>,
          TBindingPart,
          TRenderer
        >;
    }
  }

  scheduleUpdate(
    coroutine: Coroutine<TPart, TRenderer>,
    options: UpdateOptions = {},
  ): UpdateHandle {
    const controller = Promise.withResolvers<UpdateResult>();

    // Clone options for mutations.
    options = { ...options };
    options.priority ??=
      options.transition !== undefined
        ? 'background'
        : this._adapter.getUpdatePriority();

    const id = this._updateCount++;
    const lanes = this._adapter.getDefaultLanes() | getSchedulingLanes(options);
    const callback = (): UpdateResult => {
      const shouldTriggerFlush =
        (options.triggerFlush ?? true) && this._scheduledUpdates.isEmpty();

      this._scheduledUpdates.pushBack({
        id,
        lanes,
        coroutine,
        controller,
      });

      if (shouldTriggerFlush) {
        scheduled.then(() => {
          this.flushUpdates();
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
          const canceled: UpdateResult = { status: 'canceled', reason: error };
          controller.resolve(canceled);
          return canceled;
        });
    }

    coroutine.pendingLanes |= lanes;

    return {
      id,
      lanes,
      scheduled,
      finished: controller.promise,
    };
  }

  startTransition<T>(action: (transition: number) => T): T {
    return action(this._transitionCount++);
  }

  private _flushEffects(
    id: number,
    effects: EffectQueue,
    phase: CommitPhase,
  ): void {
    notifyObservers(this._observers, {
      type: 'effect-commit-start',
      id,
      phase,
      effects,
    });

    this._adapter.flushEffects(effects, phase);

    notifyObservers(this._observers, {
      type: 'effect-commit-end',
      id,
      phase,
      effects,
    });
  }

  private _handleRenderError(
    id: number,
    error: unknown,
    coroutine: Coroutine,
  ): void {
    let handlingScope: Scope | null = null;

    try {
      handlingScope = handleError(error, coroutine.scope);
    } catch (error) {
      throw new AbortError(coroutine, 'An error occurred during rendering.', {
        cause: error,
      });
    } finally {
      notifyObservers(this._observers, {
        type: 'render-error',
        id,
        error,
        captured: handlingScope !== null,
      });
    }

    if (
      !handlingScope.isChild() ||
      handlingScope.owner.pendingLanes === NoLanes
    ) {
      throw new InterruptError(
        coroutine,
        'An error was captured by an error boundary, but no recovery was scheduled.',
        { cause: error },
      );
    }
  }

  private async _runCommitAsync(
    frame: RenderFrame,
    lanes: Lanes,
  ): Promise<void> {
    const { id, layoutEffects, mutationEffects, passiveEffects } = frame;

    notifyObservers(this._observers, {
      type: 'commit-start',
      id,
    });

    try {
      if (mutationEffects.size > 0 || layoutEffects.size > 0) {
        const callback = () => {
          if (mutationEffects.size > 0) {
            this._flushEffects(id, mutationEffects, 'mutation');
          }

          if (layoutEffects.size > 0) {
            this._flushEffects(id, layoutEffects, 'layout');
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

      if (passiveEffects.size > 0) {
        this._adapter.requestCallback(
          () => {
            try {
              this._flushEffects(id, passiveEffects, 'passive');
            } finally {
              notifyObservers(this._observers, {
                type: 'commit-end',
                id,
              });
            }
          },
          { priority: 'background' },
        );
      }
    } finally {
      // Commit Phase ends when effects indicate failure to flush or when no
      // passive effects were scheduled.
      if (
        mutationEffects.size > 0 ||
        layoutEffects.size > 0 ||
        passiveEffects.size === 0
      ) {
        notifyObservers(this._observers, {
          type: 'commit-end',
          id,
        });
      }
    }
  }

  private _runCommitSync(frame: RenderFrame): void {
    const { id, layoutEffects, mutationEffects, passiveEffects } = frame;

    notifyObservers(this._observers, {
      type: 'commit-start',
      id,
    });

    try {
      if (mutationEffects.size > 0) {
        this._flushEffects(id, mutationEffects, 'mutation');
      }

      if (layoutEffects.size > 0) {
        this._flushEffects(id, layoutEffects, 'layout');
      }

      if (passiveEffects.size > 0) {
        this._flushEffects(id, passiveEffects, 'passive');
      }
    } finally {
      notifyObservers(this._observers, {
        type: 'commit-end',
        id,
      });
    }
  }

  private async _runRenderAsync(
    session: Session<TPart, TRenderer>,
  ): Promise<void> {
    const { frame } = session;
    const { id, lanes, coroutines } = frame;

    notifyObservers(this._observers, {
      type: 'render-start',
      id,
      lanes,
    });

    try {
      while (true) {
        for (const coroutine of coroutines.splice(
          0,
          this._maxCoroutinesPerYield,
        )) {
          notifyObservers(this._observers, {
            type: 'coroutine-start',
            id,
            coroutine,
          });

          try {
            coroutine.resume(session);
          } catch (error) {
            this._handleRenderError(id, error, coroutine);
          } finally {
            coroutine.pendingLanes &= ~frame.lanes;
          }

          notifyObservers(this._observers, {
            type: 'coroutine-end',
            id,
            coroutine,
          });
        }

        if (coroutines.length === 0) {
          break;
        }

        await this._adapter.yieldToMain();
      }
    } finally {
      frame.lanes = NoLanes;

      notifyObservers(this._observers, {
        type: 'render-end',
        id,
        lanes,
      });
    }
  }

  private _runRenderSync(session: Session<TPart, TRenderer>): void {
    const { frame } = session;
    const { id, lanes, coroutines } = frame;

    notifyObservers(this._observers, {
      type: 'render-start',
      id,
      lanes,
    });

    try {
      do {
        for (const coroutine of coroutines.splice(0)) {
          notifyObservers(this._observers, {
            type: 'coroutine-start',
            id,
            coroutine,
          });

          try {
            coroutine.resume(session);
          } catch (error) {
            this._handleRenderError(id, error, coroutine);
          } finally {
            coroutine.pendingLanes &= ~frame.lanes;
          }

          notifyObservers(this._observers, {
            type: 'coroutine-end',
            id,
            coroutine,
          });
        }
      } while (coroutines.length > 0);
    } finally {
      frame.lanes = NoLanes;

      notifyObservers(this._observers, {
        type: 'render-end',
        id,
        lanes,
      });
    }
  }
}

function createRenderFrame<TPart, TRenderer>(
  id: number,
  lanes: Lanes,
): RenderFrame<TPart, TRenderer> {
  return {
    id,
    lanes,
    coroutines: [],
    mutationEffects: new EffectQueue(),
    layoutEffects: new EffectQueue(),
    passiveEffects: new EffectQueue(),
  };
}

function generateUniqueIdentifier(length: number): string {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(length)),
    (byte, i) =>
      i === 0
        ? String.fromCharCode(0x61 + (byte % 26))
        : (byte % 36).toString(36),
  ).join('');
}

function notifyObservers(
  observers: LinkedList<SessionObserver>,
  event: SessionEvent,
): void {
  for (let node = observers.front(); node !== null; node = node.next) {
    node.value.onSessionEvent(event);
  }
}

function resetRenderFrame<TPart, TRenderer>(
  frame: RenderFrame<TPart, TRenderer>,
): void {
  frame.coroutines.length = 0;
  frame.mutationEffects.clear();
  frame.layoutEffects.clear();
  frame.passiveEffects.clear();
}
