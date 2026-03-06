import { type Backend, ExecutionMode } from './backend.js';
import { LinkedList } from './collections/linked-list.js';
import {
  CommitPhase,
  type Component,
  type ComponentState,
  type Coroutine,
  createUpdateSession,
  type Directive,
  EffectQueue,
  getLanesFromOptions,
  Lane,
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
  type UpdateHandle,
  type UpdateOptions,
  type UpdateResult,
  type UpdateSession,
  type UpdateTask,
} from './core.js';
import { toDirective } from './directive.js';
import { CapturedError, handleError, RenderError } from './error.js';
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

  private readonly _pendingUpdates: LinkedList<UpdateTask> = new LinkedList();

  private _identifierCount: number = 0;

  private readonly _maxCoroutinesPerYield: number;

  private readonly _uniqueIdentifier: string;

  private _updateCount: number = 0;

  constructor(
    backend: Backend,
    {
      maxCoroutinesPerYield = 100,
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
    const isConcurrentMode =
      (this._backend.getExecutionModes() & ExecutionMode.ConcurrentMode) !== 0;

    for (
      let pendingUpdate: UpdateTask | undefined;
      (pendingUpdate = this._pendingUpdates.front()?.value) !== undefined;
      this._pendingUpdates.popFront()
    ) {
      const { id, coroutine, lanes, continuation } = pendingUpdate;

      if ((coroutine.pendingLanes & lanes) === Lane.NoLane) {
        continuation.resolve({ canceled: true, done: true });
        continue;
      }

      const frame = createRenderFrame(id, lanes, coroutine);
      const originScope = coroutine.scope;
      const session = createUpdateSession(
        frame,
        originScope,
        originScope,
        this,
      );

      notifyObservers(this._observers, {
        type: 'update-start',
        id,
        lanes,
      });

      try {
        if (!isConcurrentMode || pendingUpdate.lanes & Lane.SyncLane) {
          this._runUpdateSync(session);
        } else {
          await this._runUpdateAsync(session);
        }

        notifyObservers(this._observers, {
          type: 'update-success',
          id,
          lanes,
        });

        continuation.resolve({ canceled: false, done: true });
      } catch (error) {
        notifyObservers(this._observers, {
          type: 'update-failure',
          id,
          lanes,
          error,
        });

        if (error instanceof CapturedError) {
          continuation.resolve({ canceled: true, done: false });
        } else {
          continuation.reject(error);
        }
      }
    }
  }

  getPendingUpdates(): IteratorObject<UpdateTask> {
    return Iterator.from(this._pendingUpdates);
  }

  nextIdentifier(): string {
    // The identifier is also valid as a view transition name.
    return this._uniqueIdentifier + '-' + this._identifierCount++;
  }

  renderComponent<TProps, TResult>(
    component: Component<TProps, TResult>,
    props: TProps,
    state: ComponentState,
    coroutine: Coroutine,
    frame: RenderFrame,
  ): TResult {
    const { id } = frame;

    const context = new RenderSession(state, coroutine, frame, this);

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
    options = {
      flushSync: false,
      immediate: false,
      priority: this._backend.getUpdatePriority(),
      triggerFlush: true,
      viewTransition: false,
      ...options,
    } satisfies Required<
      Omit<UpdateOptions, Exclude<keyof SchedulerPostTaskOptions, 'priority'>>
    >;

    const id = this._updateCount++;
    const lanes = getLanesFromOptions(options);
    const continuation = Promise.withResolvers<UpdateResult>();
    const pendingUpdate: UpdateTask = {
      id,
      lanes,
      continuation,
      coroutine,
    };

    let scheduled: Promise<UpdateResult>;

    const callback = () => {
      const shouldTriggerFlush =
        options.triggerFlush && this._pendingUpdates.isEmpty();

      this._pendingUpdates.pushBack(pendingUpdate);

      if (shouldTriggerFlush) {
        scheduled.then(() => {
          this.flushUpdates();
        });
      }

      return { canceled: false, done: true };
    };

    if (options.immediate) {
      const { promise, resolve } = Promise.withResolvers<UpdateResult>();
      scheduled = promise;
      resolve(callback());
    } else {
      scheduled = this._backend.requestCallback(callback, options).catch(() => {
        // callback() is guaranteed not to throw anything; rejection here only
        // indicates AbortSignal cancellation.
        return { canceled: true, done: false };
      });
    }

    return {
      id,
      lanes,
      scheduled,
      finished: continuation.promise,
    };
  }

  private _flushEffects(
    id: number,
    effects: EffectQueue,
    phase: CommitPhase,
  ): void {
    notifyObservers(this._observers, {
      type: 'effect-commit-start',
      id,
      effects,
      phase,
    });

    this._backend.flushEffects(effects, phase);

    notifyObservers(this._observers, {
      type: 'effect-commit-end',
      id,
      effects,
      phase,
    });
  }

  private async _runUpdateAsync(session: UpdateSession): Promise<void> {
    const { frame } = session;
    const { id, lanes, layoutEffects, mutationEffects, passiveEffects } = frame;

    notifyObservers(this._observers, {
      type: 'render-phase-start',
      id,
    });

    try {
      while (true) {
        for (const coroutine of consumeCoroutines(
          frame,
          this._maxCoroutinesPerYield,
        )) {
          try {
            coroutine.resume(session);
          } catch (error) {
            captureError(error, coroutine, session, this._observers);
          }
        }

        if (frame.pendingCoroutines.length === 0) {
          break;
        }

        await this._backend.yieldToMain();
      }
    } finally {
      frame.lanes = Lane.NoLane;

      notifyObservers(this._observers, {
        type: 'render-phase-end',
        id,
      });
    }

    notifyObservers(this._observers, {
      type: 'commit-phase-start',
      id,
      mutationEffects,
      layoutEffects,
      passiveEffects,
    });

    try {
      if (mutationEffects.length > 0 || layoutEffects.length > 0) {
        const callback = () => {
          if (mutationEffects.length > 0) {
            this._flushEffects(id, mutationEffects, CommitPhase.Mutation);
          }

          if (layoutEffects.length > 0) {
            this._flushEffects(id, layoutEffects, CommitPhase.Layout);
          }
        };

        if (lanes & Lane.ViewTransitionLane) {
          await this._backend.startViewTransition(callback);
        } else {
          await this._backend.requestCallback(callback, {
            priority: 'user-blocking',
          });
        }
      }

      if (passiveEffects.length > 0) {
        this._backend
          .requestCallback(
            () => {
              this._flushEffects(id, passiveEffects, CommitPhase.Passive);
            },
            { priority: 'background' },
          )
          .finally(() => {
            notifyObservers(this._observers, {
              type: 'commit-phase-end',
              id,
              mutationEffects,
              layoutEffects,
              passiveEffects,
            });
          });
      }
    } finally {
      // Commit Phase ends when effects indicate failure to flush
      // or when no passive effects were scheduled.
      if (
        mutationEffects.length > 0 ||
        layoutEffects.length > 0 ||
        passiveEffects.length === 0
      ) {
        notifyObservers(this._observers, {
          type: 'commit-phase-end',
          id,
          mutationEffects,
          layoutEffects,
          passiveEffects,
        });
      }
    }
  }

  private _runUpdateSync(session: UpdateSession): void {
    const { frame } = session;
    const { id, layoutEffects, mutationEffects, passiveEffects } = frame;

    notifyObservers(this._observers, {
      type: 'render-phase-start',
      id,
    });

    try {
      do {
        for (const coroutine of consumeCoroutines(frame)) {
          try {
            coroutine.resume(session);
          } catch (error) {
            captureError(error, coroutine, session, this._observers);
          }
        }
      } while (frame.pendingCoroutines.length > 0);
    } finally {
      frame.lanes = Lane.NoLane;

      notifyObservers(this._observers, {
        type: 'render-phase-end',
        id,
      });
    }

    notifyObservers(this._observers, {
      type: 'commit-phase-start',
      id,
      mutationEffects,
      layoutEffects,
      passiveEffects,
    });

    try {
      if (mutationEffects.length > 0) {
        this._flushEffects(id, mutationEffects, CommitPhase.Mutation);
      }

      if (layoutEffects.length > 0) {
        this._flushEffects(id, layoutEffects, CommitPhase.Layout);
      }

      if (passiveEffects.length > 0) {
        this._flushEffects(id, passiveEffects, CommitPhase.Passive);
      }
    } finally {
      notifyObservers(this._observers, {
        type: 'commit-phase-end',
        id,
        mutationEffects,
        layoutEffects,
        passiveEffects,
      });
    }
  }
}

function captureError(
  error: unknown,
  coroutine: Coroutine,
  session: UpdateSession,
  observers: LinkedList<SessionObserver>,
): void {
  const { originScope, frame } = session;
  let handlingScope: Scope | null = null;

  try {
    handlingScope = handleError(error, coroutine.scope);
  } catch (cause) {
    throw new RenderError(coroutine, { cause });
  } finally {
    notifyObservers(observers, {
      type: 'render-error',
      id: frame.id,
      error,
      captured: handlingScope !== null,
    });
  }

  const capturedOutsideOrigin = handlingScope.level <= originScope.level;

  if (capturedOutsideOrigin) {
    // Updates must not affect scopes outside the origin.
    handlingScope = originScope;
  }

  if (handlingScope.context?.pendingLanes === Lane.NoLane) {
    handlingScope.context.detach(session);
  }

  // If the error was captured by an ErrorBoundary outside the origin scope,
  // we treat it as a graceful interruption rather than a fatal failure.
  if (capturedOutsideOrigin) {
    throw new CapturedError(undefined, { cause: error });
  }
}

function consumeCoroutines(
  frame: RenderFrame,
  maxCoroutines: number = Infinity,
): Coroutine[] {
  return frame.pendingCoroutines.splice(0, maxCoroutines);
}

function createRenderFrame(
  id: number,
  lanes: Lanes,
  coroutine: Coroutine,
): RenderFrame {
  return {
    id,
    lanes,
    pendingCoroutines: [coroutine],
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
