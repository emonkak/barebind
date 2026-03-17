import { LinkedList } from './collections/linked-list.js';
import {
  type Backend,
  type CommitPhase,
  type Component,
  type Coroutine,
  createUpdateSession,
  type Directive,
  EffectQueue,
  type Hook,
  type Lanes,
  type Part,
  type Primitive,
  type RenderFrame,
  type Scope,
  type SessionContext,
  type SessionEvent,
  type SessionObserver,
  type Slot,
  type Template,
  type TemplateMode,
  type UnwrapBindable,
  type Update,
  type UpdateHandle,
  type UpdateOptions,
  type UpdateResult,
  type UpdateSession,
} from './core.js';
import { toDirective } from './directive.js';
import {
  handleError,
  InterruptError,
  RecoverableInterruptError,
} from './error.js';
import {
  getSchedulingLanes,
  NoLanes,
  SyncLane,
  ViewTransitionLane,
} from './lane.js';
import { RenderSession } from './render-session.js';

export interface RuntimeOptions {
  uniqueIdentifier?: string;
  maxCoroutinesPerYield?: number;
}

export class Runtime implements SessionContext {
  private readonly _backend: Backend;

  private readonly _cachedTemplates: WeakMap<
    readonly string[],
    Template<readonly unknown[]>
  > = new WeakMap();

  private readonly _observers: LinkedList<SessionObserver> = new LinkedList();

  private _identifierCount: number = 0;

  private readonly _maxCoroutinesPerYield: number;

  private readonly _scheduledUpdates: LinkedList<Update> = new LinkedList();

  private _transitionCount: number = 0;

  private readonly _uniqueIdentifier: string;

  private _updateCount: number = 0;

  constructor(
    backend: Backend,
    {
      maxCoroutinesPerYield = 64,
      uniqueIdentifier = generateUniqueIdentifier(8),
    }: RuntimeOptions = {},
  ) {
    this._backend = backend;
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
      let udpate: Update | undefined;
      (udpate = this._scheduledUpdates.front()?.value) !== undefined;
      this._scheduledUpdates.popFront()
    ) {
      const { controller, coroutine, id, lanes } = udpate;

      if ((coroutine.pendingLanes & lanes) === NoLanes) {
        controller.resolve({ status: 'skipped' });
        continue;
      }

      const frame = createRenderFrame(id, lanes);
      const session = createUpdateSession(
        frame,
        coroutine.scope,
        coroutine,
        this,
      );

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

        if (error instanceof InterruptError) {
          notifyObservers(this._observers, {
            type: 'commit-cancel',
            id,
            reason: error,
          });
        }

        if (error instanceof RecoverableInterruptError) {
          controller.resolve({ status: 'canceled', reason: error.cause });
        } else {
          controller.reject(error);
        }
      }
    }
  }

  getScheduledUpdates(): Update[] {
    return Array.from(this._scheduledUpdates);
  }

  nextIdentifier(): string {
    // The identifier is also valid as a view transition name.
    return this._uniqueIdentifier + '-' + this._identifierCount++;
  }

  renderComponent<TProps, TResult>(
    component: Component<TProps, TResult>,
    props: TProps,
    hooks: Hook[],
    frame: RenderFrame,
    scope: Scope,
    coroutine: Coroutine,
  ): TResult {
    const { id } = frame;

    const context = new RenderSession(hooks, frame, scope, coroutine, this);

    notifyObservers(this._observers, {
      type: 'component-render-start',
      id,
      component,
      props,
      context,
    });

    const result = component.render(props, context);

    context.finalize();

    notifyObservers(this._observers, {
      type: 'component-render-end',
      id,
      component,
      props,
      context,
    });

    return result;
  }

  resolveDirective<T>(
    source: T,
    part: Part,
  ): Required<Directive<UnwrapBindable<T>>> {
    let { type, value, layout, defaultLayout } = toDirective(source);

    if (type === undefined) {
      type = this._backend.resolvePrimitive(source, part) as Primitive<
        UnwrapBindable<T>
      >;
      (type as Primitive<UnwrapBindable<T>>).ensureValue?.(source, part);
    }

    defaultLayout ??= this._backend.resolveLayout(source, part);
    layout ??= defaultLayout;

    return { type, value, layout, defaultLayout };
  }

  resolveSlot<T>(source: T, part: Part): Slot<T> {
    const { type, value, layout, defaultLayout } = this.resolveDirective(
      source,
      part,
    );
    const binding = type.resolveBinding(value, part, this);
    return layout.placeBinding(binding, defaultLayout);
  }

  resolveTemplate(
    strings: readonly string[],
    values: readonly unknown[],
    mode: TemplateMode,
  ): Template<readonly unknown[]> {
    let template = this._cachedTemplates.get(strings);

    if (template === undefined) {
      template = this._backend.parseTemplate(
        strings,
        values,
        this._uniqueIdentifier,
        mode,
      );
      this._cachedTemplates.set(strings, template);
    }

    return template;
  }

  scheduleUpdate(
    coroutine: Coroutine,
    options: UpdateOptions = {},
  ): UpdateHandle {
    const controller = Promise.withResolvers<UpdateResult>();

    // Clone options for mutations.
    options = { ...options };
    options.priority ??= options.transition
      ? 'background'
      : this._backend.getUpdatePriority();

    const id = this._updateCount++;
    const lanes = this._backend.getDefaultLanes() | getSchedulingLanes(options);
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
      scheduled = this._backend
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

  startTransition(
    action: (transition: number) => Promise<void> | void,
  ): Promise<void> | void {
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

    this._backend.flushEffects(effects, phase);

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
      throw new InterruptError(
        coroutine,
        'An error occurred during rendering.',
        {
          cause: error,
        },
      );
    } finally {
      notifyObservers(this._observers, {
        type: 'render-error',
        id,
        error,
        captured: handlingScope !== null,
      });
    }

    if ((handlingScope.owner?.pendingLanes ?? NoLanes) === NoLanes) {
      throw new RecoverableInterruptError(
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
          await this._backend.startViewTransition(callback);
        } else {
          await this._backend.requestCallback(callback, {
            priority: 'user-blocking',
          });
        }
      }

      if (passiveEffects.size > 0) {
        this._backend.requestCallback(
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

  private async _runRenderAsync(session: UpdateSession): Promise<void> {
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
          try {
            coroutine.resume(session);
            coroutine.pendingLanes &= ~frame.lanes;
          } catch (error) {
            this._handleRenderError(id, error, coroutine);
          }
        }

        if (coroutines.length === 0) {
          break;
        }

        await this._backend.yieldToMain();
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

  private _runRenderSync(session: UpdateSession): void {
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
          try {
            coroutine.resume(session);
            coroutine.pendingLanes &= ~frame.lanes;
          } catch (error) {
            this._handleRenderError(id, error, coroutine);
          }
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

function createRenderFrame(id: number, lanes: Lanes): RenderFrame {
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

function resetRenderFrame(frame: RenderFrame): void {
  frame.coroutines.length = 0;
  frame.mutationEffects.clear();
  frame.layoutEffects.clear();
  frame.passiveEffects.clear();
}
