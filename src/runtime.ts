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
  type Layout,
  type Part,
  type Primitive,
  type RenderContext,
  type RenderFrame,
  type RequestCallbackOptions,
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

export interface RuntimeBackend {
  flushEffects(effects: EffectQueue, phase: CommitPhase): void;
  flushUpdate(runtime: Runtime): void;
  getUpdatePriority(): TaskPriority;
  parseTemplate(
    strings: readonly string[],
    args: readonly unknown[],
    markerToken: string,
    mode: TemplateMode,
  ): Template<readonly unknown[]>;
  requestCallback<T>(
    callback: () => T | PromiseLike<T>,
    options?: RequestCallbackOptions,
  ): Promise<T>;
  resolveLayout(source: unknown, part: Part): Layout;
  resolvePrimitive(source: unknown, part: Part): Primitive<unknown>;
  startViewTransition(callback: () => Promise<void> | void): Promise<void>;
  yieldToMain(): Promise<void>;
}

export type RuntimeEvent =
  | {
      type: 'UPDATE_START';
      id: number;
      lanes: Lanes;
    }
  | {
      type: 'UPDATE_SUCCESS';
      id: number;
      lanes: Lanes;
    }
  | {
      type: 'UPDATE_FAILURE';
      id: number;
      lanes: Lanes;
      error: unknown;
    }
  | {
      type: 'RENDER_START' | 'RENDER_END';
      id: number;
    }
  | {
      type: 'COMMIT_START' | 'COMMIT_END';
      id: number;
      effects: EffectQueue;
      phase: CommitPhase;
    }
  | {
      type: 'COMPONENT_RENDER_START' | 'COMPONENT_RENDER_END';
      id: number;
      component: Component<any>;
      props: unknown;
      context: RenderContext;
    };

export interface RuntimeObserver {
  onRuntimeEvent(event: RuntimeEvent): void;
}

export interface RuntimeOptions {
  randomToken?: string;
}

export class Runtime implements SessionContext {
  private readonly _backend: RuntimeBackend;

  private readonly _cachedTemplates: WeakMap<
    readonly string[],
    Template<readonly unknown[]>
  > = new WeakMap();

  private readonly _observers: LinkedList<RuntimeObserver> = new LinkedList();

  private readonly _pendingTasks: LinkedList<UpdateTask> = new LinkedList();

  private _identifierCount: number = 0;

  private readonly _randomToken: string;

  private _updateCount: number = 0;

  constructor(
    backend: RuntimeBackend,
    { randomToken = generateRandomToken(8) }: RuntimeOptions = {},
  ) {
    this._backend = backend;
    this._randomToken = randomToken;
  }

  addObserver(observer: RuntimeObserver): () => void {
    const observers = this._observers;
    const node = observers.pushBack(observer);
    return () => {
      observers.remove(node);
    };
  }

  async flushAsync(): Promise<void> {
    for (
      let pendingTask: UpdateTask | undefined;
      (pendingTask = this._pendingTasks.front()?.value) !== undefined;
      this._pendingTasks.popFront()
    ) {
      const { coroutine, lanes, continuation } = pendingTask;

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

      try {
        notifyObservers(this._observers, {
          type: 'UPDATE_START',
          id,
          lanes,
        });

        try {
          notifyObservers(this._observers, {
            type: 'RENDER_START',
            id,
          });

          while (true) {
            for (const coroutine of consumeCoroutines(frame)) {
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

          notifyObservers(this._observers, {
            type: 'RENDER_END',
            id,
          });
        } finally {
          frame.lanes = Lane.NoLane;
        }

        const { mutationEffects, layoutEffects, passiveEffects } = frame;

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
                type: 'UPDATE_SUCCESS',
                id,
                lanes,
              });
            });
        } else {
          notifyObservers(this._observers, {
            type: 'UPDATE_SUCCESS',
            id,
            lanes,
          });
        }

        continuation.resolve({ canceled: false, done: true });
      } catch (error) {
        notifyObservers(this._observers, {
          type: 'UPDATE_FAILURE',
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

  flushSync(): void {
    for (
      let pendingTask: UpdateTask | undefined;
      (pendingTask = this._pendingTasks.front()?.value) !== undefined;
      this._pendingTasks.popFront()
    ) {
      const { coroutine, lanes, continuation } = pendingTask;

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

      try {
        notifyObservers(this._observers, {
          type: 'UPDATE_START',
          id,
          lanes,
        });

        try {
          notifyObservers(this._observers, {
            type: 'RENDER_START',
            id,
          });

          do {
            for (const coroutine of consumeCoroutines(frame)) {
              try {
                coroutine.resume(session);
              } catch (error) {
                handleError(error, coroutine, originScope, session);
              }
            }
          } while (frame.pendingCoroutines.length > 0);

          notifyObservers(this._observers, {
            type: 'RENDER_END',
            id,
          });
        } finally {
          frame.lanes = Lane.NoLane;
        }

        const { mutationEffects, layoutEffects, passiveEffects } = frame;

        if (mutationEffects.length > 0) {
          this._flushEffects(id, mutationEffects, CommitPhase.Mutation);
        }

        if (layoutEffects.length > 0) {
          this._flushEffects(id, layoutEffects, CommitPhase.Layout);
        }

        if (passiveEffects.length > 0) {
          this._flushEffects(id, passiveEffects, CommitPhase.Passive);
        }

        notifyObservers(this._observers, {
          type: 'UPDATE_SUCCESS',
          id,
          lanes,
        });

        continuation.resolve({ canceled: false, done: true });
      } catch (error) {
        notifyObservers(this._observers, {
          type: 'UPDATE_FAILURE',
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

  getPendingTasks(): IteratorObject<UpdateTask> {
    return Iterator.from(this._pendingTasks);
  }

  nextIdentifier(): string {
    const identifierCount = this._identifierCount++;
    // The identifier is also valid as a view transition name.
    return 'id-' + this._randomToken + '-' + identifierCount;
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
      type: 'COMPONENT_RENDER_START',
      id,
      component,
      props,
      context,
    });

    const result = component.render(props, context);

    context.finalize();

    notifyObservers(this._observers, {
      type: 'COMPONENT_RENDER_END',
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
        this._randomToken,
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
      immediate: options.immediate ?? false,
      priority: options.priority ?? this._backend.getUpdatePriority(),
      triggerFlush: options.triggerFlush ?? true,
      viewTransition: options.viewTransition ?? false,
    } satisfies Required<UpdateOptions>;

    const lanes = getLanesFromOptions(options);
    const continuation = Promise.withResolvers<UpdateResult>();
    const pendingTask: UpdateTask = {
      coroutine,
      lanes,
      continuation,
    };

    let scheduled: Promise<UpdateResult>;

    const callback = () => {
      const shouldTriggerFlush =
        options.triggerFlush && this._pendingTasks.isEmpty();

      this._pendingTasks.pushBack(pendingTask);

      if (shouldTriggerFlush) {
        scheduled.then(() => {
          this._backend.flushUpdate(this);
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
      type: 'COMMIT_START',
      id,
      effects,
      phase,
    });

    this._backend.flushEffects(effects, phase);

    notifyObservers(this._observers, {
      type: 'COMMIT_END',
      id,
      effects,
      phase,
    });
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

function consumeCoroutines(frame: RenderFrame): Coroutine[] {
  const { pendingCoroutines } = frame;
  frame.pendingCoroutines = [];
  return pendingCoroutines;
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

function generateRandomToken(length: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), (byte) =>
    (byte % 36).toString(36),
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

  if (currentScope.host?.pendingLanes === Lane.NoLane) {
    currentScope.host.detach(session);
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
