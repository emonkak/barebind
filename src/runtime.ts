import { type Backend, ExecutionMode } from './backend.js';
import { getCoroutineStack } from './debug/scope.js';
import {
  BoundaryType,
  CommitPhase,
  type Component,
  type ComponentState,
  type Coroutine,
  createUpdateSession,
  type Directive,
  type DirectiveType,
  EffectQueue,
  getLanesFromOptions,
  Lane,
  type Lanes,
  type Part,
  type Primitive,
  type RenderContext,
  type RenderFrame,
  type Scope,
  type SessionContext,
  type Slot,
  type Template,
  type TemplateMode,
  toDirective,
  type UnwrapBindable,
  type UpdateHandle,
  type UpdateOptions,
  type UpdateResult,
  type UpdateSession,
  type UpdateTask,
} from './internal.js';
import { LinkedList } from './linked-list.js';
import { RenderSession } from './render-session.js';

export type RuntimeEvent =
  | {
      type: 'update-start';
      id: number;
      lanes: Lanes;
    }
  | {
      type: 'update-success';
      id: number;
      lanes: Lanes;
    }
  | {
      type: 'update-failure';
      id: number;
      lanes: Lanes;
      error: unknown;
    }
  | {
      type: 'render-phase-start' | 'render-phase-end';
      id: number;
    }
  | {
      type: 'component-render-start' | 'component-render-end';
      id: number;
      component: Component<any>;
      props: unknown;
      context: RenderContext;
    }
  | {
      type: 'commit-phase-start' | 'commit-phase-end';
      id: number;
      mutationEffects: EffectQueue;
      layoutEffects: EffectQueue;
      passiveEffects: EffectQueue;
    }
  | {
      type: 'effect-commit-start' | 'effect-commit-end';
      id: number;
      effects: EffectQueue;
      phase: CommitPhase;
    };

export interface RuntimeObserver {
  onRuntimeEvent(event: RuntimeEvent): void;
}

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

  private readonly _observers: LinkedList<RuntimeObserver> = new LinkedList();

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

  addObserver(observer: RuntimeObserver): () => void {
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
      const { coroutine, lanes, continuation } = pendingUpdate;

      if ((coroutine.pendingLanes & lanes) === Lane.NoLane) {
        continuation.resolve({ canceled: true, done: true });
        continue;
      }

      const id = this._updateCount++;
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
    scope: Scope,
  ): TResult {
    const { id } = frame;

    const context = new RenderSession(state, coroutine, frame, scope, this);

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

  resolveDirective<T>(source: T, part: Part): Directive<UnwrapBindable<T>> {
    let { type, value, layout, defaultLayout } = toDirective(source);

    if (type === undefined) {
      type = this._backend.resolvePrimitive(source, part) as DirectiveType<
        UnwrapBindable<T>
      >;
      (type as Primitive<UnwrapBindable<T>>).ensureValue?.(source, part);
    }

    value ??= source as UnwrapBindable<T>;
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
    args: readonly unknown[],
    mode: TemplateMode,
  ): Template<readonly unknown[]> {
    let template = this._cachedTemplates.get(strings);

    if (template === undefined) {
      template = this._backend.parseTemplate(
        strings,
        args,
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
      flushSync: options.flushSync ?? false,
      immediate: options.immediate ?? false,
      priority: options.priority ?? this._backend.getUpdatePriority(),
      triggerFlush: options.triggerFlush ?? true,
      viewTransition: options.viewTransition ?? false,
    } satisfies Required<UpdateOptions>;

    const lanes = getLanesFromOptions(options);
    const continuation = Promise.withResolvers<UpdateResult>();
    const pendingUpdate: UpdateTask = {
      coroutine,
      lanes,
      continuation,
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
      scheduled = this._backend.requestCallback(callback, options);
    }

    return {
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
    const { frame, originScope } = session;
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
            handleError(error, coroutine, originScope, session);
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

    let shouldFinalize = true;

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
        shouldFinalize = false;
      }
    } finally {
      // Commit Phase ends when effects indicate failure to flush
      // or when no passive effects were scheduled.
      if (shouldFinalize) {
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
    const { frame, originScope } = session;
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
            handleError(error, coroutine, originScope, session);
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

export class RenderError extends Error {
  constructor(coroutine: Coroutine, options?: ErrorOptions) {
    let message = 'An error occurred while rendering.';

    DEBUG: {
      message += getCoroutineStack(coroutine)
        .reverse()
        .map((coroutine, i, stack) => {
          const prefix = i > 0 ? '   '.repeat(i - 1) + '`- ' : '';
          const suffix =
            i === stack.length - 1 ? ' <- ERROR occurred here!' : '';
          return '\n' + prefix + coroutine.name + suffix;
        })
        .join('');
    }

    super(message, options);
  }
}

class CapturedError extends Error {}

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

function handleError(
  error: unknown,
  coroutine: Coroutine,
  originScope: Scope,
  session: UpdateSession,
): void {
  let currentScope = coroutine.scope;
  let { parent: nextScope, boundary: nextBoundary } = currentScope;

  const handleError = (error: unknown) => {
    while (true) {
      while (nextBoundary !== null) {
        const boundary = nextBoundary;
        nextBoundary = nextBoundary.next;
        if (boundary.type === BoundaryType.Error) {
          const { handler } = boundary;
          handler(error, handleError);
          return;
        }
      }

      if (nextScope !== null) {
        const { parent, boundary } = nextScope;
        currentScope = nextScope;
        nextScope = parent;
        nextBoundary = boundary;
      } else {
        throw new RenderError(coroutine, { cause: error });
      }
    }
  };

  handleError(error);

  if (currentScope.context?.pendingLanes === Lane.NoLane) {
    currentScope.context.detach(session);
  }

  // If the error was captured by an ErrorBoundary outside the origin scope,
  // we treat it as a graceful interruption rather than a fatal failure.
  if (currentScope.level <= originScope.level) {
    throw new CapturedError(undefined, { cause: error });
  }
}

function notifyObservers(
  observers: LinkedList<RuntimeObserver>,
  event: RuntimeEvent,
): void {
  for (let node = observers.front(); node !== null; node = node.next) {
    node.value.onRuntimeEvent(event);
  }
}
