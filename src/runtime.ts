/// <reference path="../typings/scheduler.d.ts" />

import {
  $toDirective,
  type Backend,
  type CommitContext,
  CommitPhase,
  type Component,
  type ComponentResult,
  type Coroutine,
  type Directive,
  type DirectiveType,
  type Effect,
  getFlushLanesFromOptions,
  getScheduleLanesFromOptions,
  type Hook,
  isBindable,
  Lanes,
  type Literal,
  type Part,
  PartType,
  type Primitive,
  type RenderContext,
  Scope,
  type Slot,
  type Template,
  type TemplateLiteral,
  type TemplateMode,
  type UpdateContext,
  type UpdateOptions,
  type UpdateTask,
} from './core.js';
import { debugValue } from './debug/value.js';
import { LinkedList } from './linked-list.js';
import { RenderSession } from './render-session.js';
import { TemplateLiteralPreprocessor } from './template-literal.js';

export type RuntimeEvent =
  | {
      type: 'UPDATE_START' | 'UPDATE_END';
      id: number;
      lanes: Lanes;
      concurrent: boolean;
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
      component: Component<unknown, unknown>;
      props: unknown;
      context: RenderContext;
    };

export interface RuntimeObserver {
  onRuntimeEvent(event: RuntimeEvent): void;
}

export interface RuntimeOptions {
  concurrent?: boolean;
}

interface CoroutineState {
  pendingLanes: Lanes;
}

interface Environment {
  backend: Backend;
  cachedTemplates: WeakMap<readonly string[], Template<readonly unknown[]>>;
  concurrent: boolean;
  coroutineStates: WeakMap<Coroutine, CoroutineState>;
  identifierCount: number;
  observers: LinkedList<RuntimeObserver>;
  scheduledTasks: LinkedList<UpdateTask>;
  templateLiteralPreprocessor: TemplateLiteralPreprocessor;
  templatePlaceholder: string;
  updateCount: number;
}

interface UpdateFrame {
  id: number;
  pendingCoroutines: Coroutine[];
  mutationEffects: Effect[];
  layoutEffects: Effect[];
  passiveEffects: Effect[];
}

export class Runtime implements CommitContext, UpdateContext {
  private readonly _updateFrame: UpdateFrame;

  private readonly _scope: Scope;

  private readonly _environment: Environment;

  static create(backend: Backend, options: RuntimeOptions = {}): Runtime {
    const updateFrame: UpdateFrame = {
      id: 0,
      pendingCoroutines: [],
      mutationEffects: [],
      layoutEffects: [],
      passiveEffects: [],
    };
    const scope = new Scope(null);
    const environment: Environment = {
      backend,
      cachedTemplates: new WeakMap(),
      concurrent: options.concurrent ?? false,
      coroutineStates: new WeakMap(),
      identifierCount: 0,
      observers: new LinkedList(),
      scheduledTasks: new LinkedList(),
      templateLiteralPreprocessor: new TemplateLiteralPreprocessor(),
      templatePlaceholder: generateRandomString(8),
      updateCount: 0,
    };
    return new Runtime(updateFrame, scope, environment);
  }

  private constructor(
    updateFrame: UpdateFrame,
    scope: Scope,
    environment: Environment,
  ) {
    this._updateFrame = updateFrame;
    this._scope = scope;
    this._environment = environment;
  }

  observe(observer: RuntimeObserver): () => void {
    const observers = this._environment.observers;
    const node = observers.pushBack(observer);
    return () => {
      observers.remove(node);
    };
  }

  debugValue(type: DirectiveType<unknown>, value: unknown, part: Part): void {
    if (
      part.type === PartType.ChildNode &&
      (part.node.data === '' ||
        part.node.data.startsWith('/' + type.name + '('))
    ) {
      part.node.data = `/${type.name}(${debugValue(value)})`;
    }
  }

  enqueueCoroutine(coroutine: Coroutine): void {
    this._updateFrame.pendingCoroutines.push(coroutine);
  }

  enqueueLayoutEffect(effect: Effect): void {
    this._updateFrame.layoutEffects.push(effect);
  }

  enqueueMutationEffect(effect: Effect): void {
    this._updateFrame.mutationEffects.push(effect);
  }

  enqueuePassiveEffect(effect: Effect): void {
    this._updateFrame.passiveEffects.push(effect);
  }

  enterScope(scope: Scope): Runtime {
    return new Runtime(this._updateFrame, scope, this._environment);
  }

  expandLiterals<T>(
    strings: TemplateStringsArray,
    values: readonly (T | Literal)[],
  ): TemplateLiteral<T> {
    return this._environment.templateLiteralPreprocessor.process(
      strings,
      values,
    );
  }

  async flushAsync(lanes: Lanes): Promise<void> {
    const { coroutineStates, backend, observers } = this._environment;

    if (!observers.isEmpty()) {
      notifyObservers(observers, {
        type: 'UPDATE_START',
        id: this._updateFrame.id,
        lanes,
        concurrent: true,
      });
    }

    try {
      if (!observers.isEmpty()) {
        notifyObservers(observers, {
          type: 'RENDER_START',
          id: this._updateFrame.id,
        });
      }

      while (true) {
        const coroutines = consumeCoroutines(this._updateFrame);

        for (let i = 0, l = coroutines.length; i < l; i++) {
          const coroutine = coroutines[i]!;
          const coroutineState = coroutineStates.get(coroutine);
          const pendingLanes = coroutine.resume(lanes, this);

          if (coroutineState !== undefined) {
            coroutineState.pendingLanes = pendingLanes;
          }
        }

        if (this._updateFrame.pendingCoroutines.length === 0) {
          break;
        }

        await backend.yieldToMain();
      }

      if (!observers.isEmpty()) {
        notifyObservers(observers, {
          type: 'RENDER_END',
          id: this._updateFrame.id,
        });
      }

      const { mutationEffects, layoutEffects, passiveEffects } = consumeEffects(
        this._updateFrame,
      );
      const callback = () => {
        this._commitEffects(mutationEffects, CommitPhase.Mutation);
        this._commitEffects(layoutEffects, CommitPhase.Layout);
      };

      if (lanes & Lanes.ViewTransitionLane) {
        await backend.startViewTransition(callback);
      } else {
        await backend.requestCallback(callback, {
          priority: 'user-blocking',
        });
      }

      if (passiveEffects.length > 0) {
        await backend.requestCallback(
          () => {
            this._commitEffects(passiveEffects, CommitPhase.Passive);
          },
          { priority: 'background' },
        );
      }
    } finally {
      if (!observers.isEmpty()) {
        notifyObservers(observers, {
          type: 'UPDATE_END',
          id: this._updateFrame.id,
          lanes,
          concurrent: true,
        });
      }
    }
  }

  flushSync(lanes: Lanes): void {
    const { coroutineStates, observers } = this._environment;

    if (!observers.isEmpty()) {
      notifyObservers(observers, {
        type: 'UPDATE_START',
        id: this._updateFrame.id,
        lanes,
        concurrent: false,
      });
    }

    try {
      if (!observers.isEmpty()) {
        notifyObservers(observers, {
          type: 'RENDER_START',
          id: this._updateFrame.id,
        });
      }

      do {
        const coroutines = consumeCoroutines(this._updateFrame);

        for (let i = 0, l = coroutines.length; i < l; i++) {
          const coroutine = coroutines[i]!;
          const coroutineState = coroutineStates.get(coroutine);
          const pendingLanes = coroutine.resume(lanes, this);

          if (coroutineState !== undefined) {
            coroutineState.pendingLanes = pendingLanes;
          }
        }
      } while (this._updateFrame.pendingCoroutines.length > 0);

      if (!observers.isEmpty()) {
        notifyObservers(observers, {
          type: 'RENDER_END',
          id: this._updateFrame.id,
        });
      }

      const { mutationEffects, layoutEffects, passiveEffects } = consumeEffects(
        this._updateFrame,
      );

      this._commitEffects(mutationEffects, CommitPhase.Mutation);
      this._commitEffects(layoutEffects, CommitPhase.Layout);
      this._commitEffects(passiveEffects, CommitPhase.Passive);
    } finally {
      if (!observers.isEmpty()) {
        notifyObservers(observers, {
          type: 'UPDATE_END',
          id: this._updateFrame.id,
          lanes,
          concurrent: false,
        });
      }
    }
  }

  getCurrentScope(): Scope {
    return this._scope;
  }

  getScheduledTasks(): LinkedList<UpdateTask> {
    return this._environment.scheduledTasks;
  }

  nextIdentifier(): string {
    const prefix = this._environment.templatePlaceholder;
    const id = incrementIdentifier(this._environment.identifierCount);
    this._environment.identifierCount = id;
    return prefix + ':' + id;
  }

  renderComponent<TProps, TResult>(
    component: Component<TProps, TResult>,
    props: TProps,
    hooks: Hook[],
    lanes: Lanes,
    coroutine: Coroutine,
  ): ComponentResult<TResult> {
    const { observers } = this._environment;
    const context = new RenderSession(hooks, lanes, coroutine, this);

    if (!observers.isEmpty()) {
      notifyObservers(observers, {
        type: 'COMPONENT_RENDER_START',
        id: this._updateFrame.id,
        component,
        props,
        context,
      });
    }

    const value = component.render(props, context);
    const pendingLanes = context.finalize();

    if (!observers.isEmpty()) {
      notifyObservers(observers, {
        type: 'COMPONENT_RENDER_END',
        id: this._updateFrame.id,
        component,
        props,
        context,
      });
    }

    return { value, pendingLanes };
  }

  resolveDirective<T>(value: T, part: Part): Directive<unknown> {
    if (isBindable(value)) {
      return value[$toDirective](part, this);
    } else {
      const type = this._environment.backend.resolvePrimitive(value, part);
      type.ensureValue?.(value, part);
      return { type: type as Primitive<T>, value };
    }
  }

  resolveSlot<T>(value: T, part: Part): Slot<T> {
    const directive = this.resolveDirective(value, part);
    const binding = directive.type.resolveBinding(directive.value, part, this);
    const slotType =
      directive.slotType ??
      this._environment.backend.resolveSlotType(value, part);
    return new slotType(binding);
  }

  resolveTemplate(
    strings: readonly string[],
    binds: readonly unknown[],
    mode: TemplateMode,
  ): Template<readonly unknown[]> {
    const { backend, cachedTemplates, templatePlaceholder } = this._environment;
    let template = cachedTemplates.get(strings);

    if (template === undefined) {
      template = backend.parseTemplate(
        strings,
        binds,
        templatePlaceholder,
        mode,
      );
      cachedTemplates.set(strings, template);
    }

    return template;
  }

  scheduleUpdate(
    coroutine: Coroutine,
    options: UpdateOptions = {},
  ): UpdateTask {
    const { backend, concurrent, coroutineStates, scheduledTasks } =
      this._environment;
    const completeOptions: Required<UpdateOptions> = {
      concurrent: options.concurrent ?? concurrent,
      priority: options.priority ?? backend.getCurrentPriority(),
      viewTransition: options.viewTransition ?? false,
    };
    const scheduleLanes = getScheduleLanesFromOptions(completeOptions);

    for (const scheduledTask of scheduledTasks) {
      if (
        scheduledTask.coroutine === coroutine &&
        scheduledTask.lanes === scheduleLanes &&
        !scheduledTask.running
      ) {
        return scheduledTask;
      }
    }

    let coroutineState = coroutineStates.get(coroutine);

    if (coroutineState !== undefined) {
      coroutineState.pendingLanes |= scheduleLanes;
    } else {
      coroutineState = { pendingLanes: scheduleLanes };
      coroutineStates.set(coroutine, coroutineState);
    }

    const scheduledTaskNode = scheduledTasks.pushBack({
      coroutine,
      lanes: scheduleLanes,
      running: false,
      promise: backend.requestCallback(async () => {
        try {
          if ((coroutineState.pendingLanes & scheduleLanes) !== scheduleLanes) {
            return;
          }

          scheduledTaskNode.value.running = true;

          const subcontext = this._createSubcontext(coroutine);
          const flushLanes = getFlushLanesFromOptions(completeOptions);

          if (completeOptions.concurrent) {
            await subcontext.flushAsync(flushLanes);
          } else {
            subcontext.flushSync(flushLanes);
          }
        } finally {
          scheduledTasks.remove(scheduledTaskNode);
        }
      }, completeOptions),
    });

    return scheduledTaskNode.value;
  }

  undebugValue(
    type: DirectiveType<unknown>,
    _value: unknown,
    part: Part,
  ): void {
    if (
      part.type === PartType.ChildNode &&
      part.node.data.startsWith('/' + type.name + '(')
    ) {
      part.node.data = '';
    }
  }

  private _commitEffects(effects: Effect[], phase: CommitPhase): void {
    const { backend, observers } = this._environment;

    if (!observers.isEmpty()) {
      notifyObservers(observers, {
        type: 'COMMIT_START',
        id: this._updateFrame.id,
        effects,
        phase,
      });
    }

    backend.commitEffects(effects, phase, this);

    if (!observers.isEmpty()) {
      notifyObservers(observers, {
        type: 'COMMIT_END',
        id: this._updateFrame.id,
        effects,
        phase,
      });
    }
  }

  private _createSubcontext(coroutine: Coroutine): Runtime {
    const updateCount = incrementIdentifier(this._environment.updateCount);
    const updateFrame: UpdateFrame = {
      id: updateCount,
      pendingCoroutines: [coroutine],
      mutationEffects: [coroutine],
      layoutEffects: [],
      passiveEffects: [],
    };

    this._environment.updateCount = updateCount;

    return new Runtime(updateFrame, this._scope, this._environment);
  }
}

function consumeCoroutines(updateFrame: UpdateFrame): Coroutine[] {
  const { pendingCoroutines } = updateFrame;
  updateFrame.pendingCoroutines = [];
  return pendingCoroutines;
}

function consumeEffects(
  updateFrame: UpdateFrame,
): Pick<UpdateFrame, 'mutationEffects' | 'layoutEffects' | 'passiveEffects'> {
  const { mutationEffects, layoutEffects, passiveEffects } = updateFrame;
  updateFrame.mutationEffects = [];
  updateFrame.layoutEffects = [];
  updateFrame.passiveEffects = [];
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
