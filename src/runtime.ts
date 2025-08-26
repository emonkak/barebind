import { LinkedList } from './collections/linked-list.js';
import {
  $toDirective,
  CommitPhase,
  type Component,
  type Coroutine,
  createScope,
  createUpdateContext,
  type Directive,
  type Effect,
  getLanesFromOptions,
  type Hook,
  isBindable,
  Lanes,
  type Part,
  type Primitive,
  type RenderContext,
  type RequestCallbackOptions,
  type ScheduleOptions,
  type Scope,
  type SessionContext,
  type Slot,
  type SlotType,
  type Template,
  type TemplateFactory,
  type TemplateMode,
  type UnwrapBindable,
  type UpdateFrame,
  type UpdateHandle,
  type UpdateTask,
} from './internal.js';
import { RenderSession } from './render-session.js';
import {
  type Literal,
  type TemplateLiteral,
  TemplateLiteralPreprocessor,
} from './template-literal.js';

export interface RuntimeBackend {
  commitEffects(effects: Effect[], phase: CommitPhase): void;
  getCurrentPriority(): TaskPriority;
  getTemplateFactory(): TemplateFactory;
  flushUpdate(runtime: Runtime): void;
  requestCallback(
    callback: () => Promise<void> | void,
    options?: RequestCallbackOptions,
  ): Promise<void>;
  resolvePrimitive(value: unknown, part: Part): Primitive<unknown>;
  resolveSlotType(value: unknown, part: Part): SlotType;
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

  private readonly _templatePlaceholder: string = generateRandomString(8);

  private _identifierCount: number = 0;

  private _updateCount: number = 0;

  constructor(backend: RuntimeBackend, options: RuntimeOptions = {}) {
    this._backend = backend;
    this._templatePlaceholder =
      options.templatePlaceholder ?? generateRandomString(8);
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
        continuation.resolve();
        continue;
      }

      const id = (this._updateCount = incrementIdentifier(this._updateCount));
      const frame = createUpdateFrame(id, lanes, coroutine);
      const scope = createScope();

      try {
        if (!this._observers.isEmpty()) {
          notifyObservers(this._observers, {
            type: 'UPDATE_START',
            id,
            lanes,
          });

          notifyObservers(this._observers, {
            type: 'RENDER_START',
            id,
          });
        }

        const context = createUpdateContext(frame, scope, this);

        while (true) {
          const coroutines = consumeCoroutines(frame);

          for (let i = 0, l = coroutines.length; i < l; i++) {
            coroutines[i]!.resume(context);
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
              },
              { priority: 'background' },
            )
            .then(continuation.resolve, continuation.reject);
        } else {
          continuation.resolve();
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
        continuation.resolve();
        continue;
      }

      const id = (this._updateCount = incrementIdentifier(this._updateCount));
      const frame = createUpdateFrame(id, lanes, coroutine);
      const scope = createScope();

      try {
        if (!this._observers.isEmpty()) {
          notifyObservers(this._observers, {
            type: 'UPDATE_START',
            id,
            lanes,
          });

          notifyObservers(this._observers, {
            type: 'RENDER_START',
            id,
          });
        }

        const context = createUpdateContext(frame, scope, this);

        while (true) {
          const coroutines = consumeCoroutines(frame);

          for (let i = 0, l = coroutines.length; i < l; i++) {
            coroutines[i]!.resume(context);
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

        continuation.resolve();
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

  getPendingTasks(): UpdateTask[] {
    return Array.from(this._pendingTasks);
  }

  nextIdentifier(): string {
    const prefix = this._templatePlaceholder;
    const id = (this._identifierCount = incrementIdentifier(
      this._identifierCount,
    ));
    return prefix + ':' + id;
  }

  renderComponent<TProps, TResult>(
    component: Component<TProps, TResult>,
    props: TProps,
    hooks: Hook[],
    coroutine: Coroutine,
    frame: UpdateFrame,
    scope: Scope,
  ): TResult {
    const { id } = frame;
    const context = new RenderSession(hooks, coroutine, frame, scope, this);

    if (!this._observers.isEmpty()) {
      notifyObservers(this._observers, {
        type: 'COMPONENT_RENDER_START',
        id,
        component,
        props,
        context,
      });
    }

    const result = component.render(props, context);

    context.finalize();

    if (!this._observers.isEmpty()) {
      notifyObservers(this._observers, {
        type: 'COMPONENT_RENDER_END',
        id,
        component,
        props,
        context,
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
    const slotType =
      directive.slotType ?? this._backend.resolveSlotType(value, part);
    return new slotType(binding);
  }

  resolveTemplate(
    strings: readonly string[],
    binds: readonly unknown[],
    mode: TemplateMode,
  ): Template<readonly unknown[]> {
    let template = this._cachedTemplates.get(strings);

    if (template === undefined) {
      template = this._backend
        .getTemplateFactory()
        .parseTemplate(strings, binds, this._templatePlaceholder, mode);
      this._cachedTemplates.set(strings, template);
    }

    return template;
  }

  scheduleUpdate(
    coroutine: Coroutine,
    options: ScheduleOptions = {},
  ): UpdateHandle {
    options = {
      immediate: options.immediate ?? false,
      priority: options.priority ?? this._backend.getCurrentPriority(),
      silent: options.silent ?? false,
      viewTransition: options.viewTransition ?? false,
    } satisfies Required<ScheduleOptions>;

    const lanes = getLanesFromOptions(options);
    const continuation = Promise.withResolvers<void>();
    const pendingTask: UpdateTask = {
      coroutine,
      lanes,
      continuation,
    };

    coroutine.pendingLanes |= lanes;

    let scheduled: Promise<void>;

    if (options.immediate) {
      const shouldFlush = !options.silent && this._pendingTasks.isEmpty();

      this._pendingTasks.pushBack(pendingTask);

      scheduled = Promise.resolve();

      if (shouldFlush) {
        queueMicrotask(() => {
          this._backend.flushUpdate(this);
        });
      }
    } else {
      scheduled = this._backend.requestCallback(() => {
        const shouldFlush = !options.silent && this._pendingTasks.isEmpty();

        this._pendingTasks.pushBack(pendingTask);

        if (shouldFlush) {
          this._backend.flushUpdate(this);
        }
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

function createUpdateFrame(
  id: number,
  lanes: Lanes,
  coroutine: Coroutine,
): UpdateFrame {
  return {
    id,
    lanes,
    pendingCoroutines: [coroutine],
    mutationEffects: [],
    layoutEffects: [],
    passiveEffects: [],
  };
}

function consumeCoroutines(frame: UpdateFrame): Coroutine[] {
  const { pendingCoroutines } = frame;
  frame.pendingCoroutines = [];
  return pendingCoroutines;
}

function consumeEffects(
  frame: UpdateFrame,
): Pick<UpdateFrame, 'mutationEffects' | 'layoutEffects' | 'passiveEffects'> {
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

function incrementIdentifier(id: number): number {
  return (id % Number.MAX_SAFE_INTEGER) + 1;
}

function notifyObservers(
  observers: LinkedList<RuntimeObserver>,
  event: RuntimeEvent,
): void {
  for (let node = observers.front(); node !== null; node = node.next) {
    node.value.onRuntimeEvent(event);
  }
}
