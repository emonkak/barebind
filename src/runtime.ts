import {
  $toDirective,
  CommitPhase,
  type Component,
  type ComponentState,
  type Coroutine,
  createUpdateSession,
  type Directive,
  type Effect,
  getLanesFromOptions,
  isBindable,
  Lanes,
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
  type UnwrapBindable,
  type UpdateHandle,
  type UpdateOptions,
  type UpdateResult,
  type UpdateTask,
} from './internal.js';
import { LinkedList } from './linked-list.js';
import { RenderSession } from './render-session.js';
import { handleError } from './scope.js';
import {
  type Literal,
  type TemplateLiteral,
  TemplateLiteralPreprocessor,
} from './template-literal.js';

export interface RuntimeBackend {
  commitEffects(effects: Effect[], phase: CommitPhase): void;
  flushUpdate(runtime: Runtime): void;
  getTaskPriority(): TaskPriority;
  parseTemplate(
    strings: readonly string[],
    binds: readonly unknown[],
    placeholder: string,
    mode: TemplateMode,
  ): Template<readonly unknown[]>;
  requestCallback<T>(
    callback: () => T | PromiseLike<T>,
    options?: RequestCallbackOptions,
  ): Promise<T>;
  resolveLayout(value: unknown, part: Part): Layout;
  resolvePrimitive(value: unknown, part: Part): Primitive<unknown>;
  startViewTransition(callback: () => Promise<void> | void): Promise<void>;
  yieldToMain(): Promise<void>;
}

export type RuntimeEvent =
  | {
      type: 'UPDATE_START' | 'UPDATE_END';
      id: number;
      lanes: Lanes;
    }
  | {
      type: 'RENDER_START' | 'RENDER_END';
      id: number;
    }
  | {
      type: 'COMMIT_START' | 'COMMIT_END';
      id: number;
      effects: Effect[];
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
  templatePlaceholder?: string;
}

export class Runtime implements SessionContext {
  private readonly _backend: RuntimeBackend;

  private readonly _cachedTemplates: WeakMap<
    readonly string[],
    Template<readonly unknown[]>
  > = new WeakMap();

  private readonly _observers: LinkedList<RuntimeObserver> = new LinkedList();

  private readonly _pendingTasks: LinkedList<UpdateTask> = new LinkedList();

  private readonly _templateLiteralPreprocessor: TemplateLiteralPreprocessor =
    new TemplateLiteralPreprocessor();

  private readonly _templatePlaceholder: string;

  private _identifierCount: number = 0;

  private _updateCount: number = 0;

  constructor(
    backend: RuntimeBackend,
    { templatePlaceholder = generateRandomString(8) }: RuntimeOptions = {},
  ) {
    this._backend = backend;
    this._templatePlaceholder = templatePlaceholder;
  }

  addObserver(observer: RuntimeObserver): () => void {
    const observers = this._observers;
    const node = observers.pushBack(observer);
    return () => {
      observers.remove(node);
    };
  }

  expandLiterals<T>(
    strings: TemplateStringsArray,
    values: readonly (T | Literal)[],
  ): TemplateLiteral<T> {
    return this._templateLiteralPreprocessor.process(strings, values);
  }

  async flushAsync(): Promise<void> {
    for (
      let pendingTask: UpdateTask | undefined;
      (pendingTask = this._pendingTasks.front()?.value) !== undefined;
      this._pendingTasks.popFront()
    ) {
      const { coroutine, lanes, continuation } = pendingTask;

      if ((coroutine.pendingLanes & lanes) === Lanes.NoLanes) {
        continuation.resolve({ canceled: true, done: true });
        continue;
      }

      const id = (this._updateCount = incrementCount(this._updateCount));
      const frame = createRenderFrame(id, lanes, coroutine);
      const rootScope = coroutine.scope;
      const session = createUpdateSession(frame, rootScope, rootScope, this);

      try {
        if (!this._observers.isEmpty()) {
          notifyObservers(this._observers, {
            type: 'UPDATE_START',
            id,
            lanes,
          });
        }

        try {
          if (!this._observers.isEmpty()) {
            notifyObservers(this._observers, {
              type: 'RENDER_START',
              id,
            });
          }

          while (true) {
            const coroutines = consumeCoroutines(frame);

            for (let i = 0, l = coroutines.length; i < l; i++) {
              const coroutine = coroutines[i]!;
              try {
                coroutine.resume(session);
              } catch (error) {
                handleError(coroutine.scope, error);
              }
            }

            if (frame.pendingCoroutines.length === 0) {
              break;
            }

            await this._backend.yieldToMain();
          }

          if (!this._observers.isEmpty()) {
            notifyObservers(this._observers, {
              type: 'RENDER_END',
              id,
            });
          }
        } finally {
          frame.lanes = Lanes.NoLanes;
        }

        const { mutationEffects, layoutEffects, passiveEffects } =
          consumeEffects(frame);

        if (mutationEffects.length > 0 || layoutEffects.length > 0) {
          const callback = () => {
            if (mutationEffects.length > 0) {
              this._commitEffects(id, mutationEffects, CommitPhase.Mutation);
            }

            if (layoutEffects.length > 0) {
              this._commitEffects(id, layoutEffects, CommitPhase.Layout);
            }
          };

          if (lanes & Lanes.ViewTransitionLane) {
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
                this._commitEffects(id, passiveEffects, CommitPhase.Passive);
                return { canceled: false, done: true };
              },
              { priority: 'background' },
            )
            .then(continuation.resolve, continuation.reject);
        } else {
          continuation.resolve({ canceled: false, done: true });
        }
      } catch (error) {
        continuation.reject(error);
      } finally {
        if (!this._observers.isEmpty()) {
          continuation.promise.finally(() => {
            notifyObservers(this._observers, {
              type: 'UPDATE_END',
              id,
              lanes,
            });
          });
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

      if ((coroutine.pendingLanes & lanes) === Lanes.NoLanes) {
        continuation.resolve({ canceled: true, done: true });
        continue;
      }

      const id = (this._updateCount = incrementCount(this._updateCount));
      const frame = createRenderFrame(id, lanes, coroutine);
      const rootScope = coroutine.scope;
      const session = createUpdateSession(frame, rootScope, rootScope, this);

      try {
        if (!this._observers.isEmpty()) {
          notifyObservers(this._observers, {
            type: 'UPDATE_START',
            id,
            lanes,
          });
        }

        try {
          if (!this._observers.isEmpty()) {
            notifyObservers(this._observers, {
              type: 'RENDER_START',
              id,
            });
          }

          while (true) {
            const coroutines = consumeCoroutines(frame);

            for (let i = 0, l = coroutines.length; i < l; i++) {
              const coroutine = coroutines[i]!;
              try {
                coroutine.resume(session);
              } catch (error) {
                handleError(coroutine.scope, error);
              }
            }

            if (frame.pendingCoroutines.length === 0) {
              break;
            }
          }

          if (!this._observers.isEmpty()) {
            notifyObservers(this._observers, {
              type: 'RENDER_END',
              id,
            });
          }
        } finally {
          frame.lanes = Lanes.NoLanes;
        }

        const { mutationEffects, layoutEffects, passiveEffects } =
          consumeEffects(frame);

        if (mutationEffects.length > 0) {
          this._commitEffects(id, mutationEffects, CommitPhase.Mutation);
        }

        if (layoutEffects.length > 0) {
          this._commitEffects(id, layoutEffects, CommitPhase.Layout);
        }

        if (passiveEffects.length > 0) {
          this._commitEffects(id, passiveEffects, CommitPhase.Passive);
        }

        continuation.resolve({ canceled: false, done: true });
      } catch (error) {
        continuation.reject(error);
      } finally {
        if (!this._observers.isEmpty()) {
          notifyObservers(this._observers, {
            type: 'UPDATE_END',
            id,
            lanes,
          });
        }
      }
    }
  }

  getPendingTasks(): IteratorObject<UpdateTask> {
    return Iterator.from(this._pendingTasks);
  }

  nextIdentifier(): string {
    const uniqueToken = this._templatePlaceholder;
    const count = this._identifierCount;
    this._identifierCount = incrementCount(this._identifierCount);
    // The identifier is also valid as a view transition name.
    return 'id-' + uniqueToken + '-' + count;
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
    const session = new RenderSession(state, coroutine, frame, scope, this);

    if (!this._observers.isEmpty()) {
      notifyObservers(this._observers, {
        type: 'COMPONENT_RENDER_START',
        id,
        component,
        props,
        context: session,
      });
    }

    const result = component.render(props, session);

    session.finalize();

    if (!this._observers.isEmpty()) {
      notifyObservers(this._observers, {
        type: 'COMPONENT_RENDER_END',
        id,
        component,
        props,
        context: session,
      });
    }

    return result;
  }

  resolveDirective<T>(value: T, part: Part): Directive<UnwrapBindable<T>> {
    if (isBindable(value)) {
      return value[$toDirective](part, this) as Directive<UnwrapBindable<T>>;
    } else {
      const type = this._backend.resolvePrimitive(value, part);
      type.ensureValue?.(value, part);
      return {
        type: type as Primitive<UnwrapBindable<T>>,
        value: value as UnwrapBindable<T>,
      };
    }
  }

  resolveSlot<T>(value: T, part: Part): Slot<T> {
    const directive = this.resolveDirective(value, part);
    const binding = directive.type.resolveBinding(directive.value, part, this);
    const layout = directive.layout ?? this._backend.resolveLayout(value, part);
    return layout.resolveSlot(binding);
  }

  resolveTemplate(
    strings: readonly string[],
    binds: readonly unknown[],
    mode: TemplateMode,
  ): Template<readonly unknown[]> {
    let template = this._cachedTemplates.get(strings);

    if (template === undefined) {
      template = this._backend.parseTemplate(
        strings,
        binds,
        this._templatePlaceholder,
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
      flush: options.flush ?? true,
      immediate: options.immediate ?? false,
      priority: options.priority ?? this._backend.getTaskPriority(),
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

    if (options.immediate) {
      const shouldFlush = options.flush && this._pendingTasks.isEmpty();

      this._pendingTasks.pushBack(pendingTask);

      scheduled = Promise.resolve({ canceled: false, done: true });

      if (shouldFlush) {
        queueMicrotask(() => {
          this._backend.flushUpdate(this);
        });
      }
    } else {
      scheduled = this._backend.requestCallback(() => {
        const shouldFlush = options.flush && this._pendingTasks.isEmpty();

        this._pendingTasks.pushBack(pendingTask);

        if (shouldFlush) {
          this._backend.flushUpdate(this);
        }

        return { canceled: false, done: true };
      }, options);
    }

    return {
      lanes,
      scheduled,
      finished: continuation.promise,
    };
  }

  private _commitEffects(
    id: number,
    effects: Effect[],
    phase: CommitPhase,
  ): void {
    if (!this._observers.isEmpty()) {
      notifyObservers(this._observers, {
        type: 'COMMIT_START',
        id,
        effects,
        phase,
      });
    }

    this._backend.commitEffects(effects, phase);

    if (!this._observers.isEmpty()) {
      notifyObservers(this._observers, {
        type: 'COMMIT_END',
        id,
        effects,
        phase,
      });
    }
  }
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
    mutationEffects: [],
    layoutEffects: [],
    passiveEffects: [],
  };
}

function consumeCoroutines(frame: RenderFrame): Coroutine[] {
  const { pendingCoroutines } = frame;
  frame.pendingCoroutines = [];
  return pendingCoroutines;
}

function consumeEffects(
  frame: RenderFrame,
): Pick<RenderFrame, 'mutationEffects' | 'layoutEffects' | 'passiveEffects'> {
  const { mutationEffects, layoutEffects, passiveEffects } = frame;
  frame.mutationEffects = [];
  frame.layoutEffects = [];
  frame.passiveEffects = [];
  return {
    mutationEffects,
    layoutEffects,
    passiveEffects,
  };
}

function generateRandomString(length: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), (byte) =>
    (byte % 36).toString(36),
  ).join('');
}

function incrementCount(count: number): number {
  return (count % Number.MAX_SAFE_INTEGER) + 1;
}

function notifyObservers(
  observers: LinkedList<RuntimeObserver>,
  event: RuntimeEvent,
): void {
  for (let node = observers.front(); node !== null; node = node.next) {
    node.value.onRuntimeEvent(event);
  }
}
