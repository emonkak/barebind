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

export interface RuntimeObserver {
  onRuntimeEvent(event: RuntimeEvent): void;
}

export type RuntimeEvent =
  | {
      type: 'UPDATE_START' | 'UPDATE_END';
      id: number;
      priority: TaskPriority | null;
      viewTransition: boolean;
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

interface CoroutineState {
  pendingLanes: Lanes;
}

interface RuntimeState {
  cachedTemplates: WeakMap<readonly string[], Template<readonly unknown[]>>;
  coroutineStates: WeakMap<Coroutine, CoroutineState>;
  identifierCount: number;
  observers: LinkedList<RuntimeObserver>;
  templateLiteralPreprocessor: TemplateLiteralPreprocessor;
  templatePlaceholder: string;
  updateCount: number;
  updateTasks: LinkedList<UpdateTask>;
}

interface UpdateFrame {
  id: number;
  pendingCoroutines: Coroutine[];
  mutationEffects: Effect[];
  layoutEffects: Effect[];
  passiveEffects: Effect[];
}

export class Runtime implements CommitContext, UpdateContext {
  private readonly _backend: Backend;

  private readonly _updateFrame: UpdateFrame;

  private readonly _scope: Scope;

  private readonly _state: RuntimeState;

  constructor(
    backend: Backend,
    updateFrame: UpdateFrame = createEmptyUpdateFrame(0),
    scope: Scope = new Scope(null),
    state: RuntimeState = createRuntimeState(),
  ) {
    this._backend = backend;
    this._updateFrame = updateFrame;
    this._scope = scope;
    this._state = state;
  }

  observe(observer: RuntimeObserver): () => void {
    const observers = this._state.observers;
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
    return new Runtime(this._backend, this._updateFrame, scope, this._state);
  }

  expandLiterals<T>(
    strings: TemplateStringsArray,
    values: readonly (T | Literal)[],
  ): TemplateLiteral<T> {
    return this._state.templateLiteralPreprocessor.process(strings, values);
  }

  async flushAsync(options: Required<UpdateOptions>): Promise<void> {
    const { coroutineStates, observers } = this._state;
    const lanes = getFlushLanesFromOptions(options);

    if (!observers.isEmpty()) {
      this._notifyObservers({
        type: 'UPDATE_START',
        id: this._updateFrame.id,
        priority: options.priority,
        viewTransition: options.viewTransition,
      });
    }

    try {
      if (!observers.isEmpty()) {
        this._notifyObservers({
          type: 'RENDER_START',
          id: this._updateFrame.id,
        });
      }

      while (true) {
        const coroutines = consumeCoroutines(this._updateFrame);

        for (let i = 0, l = coroutines.length; i < l; i++) {
          const coroutine = coroutines[i]!;
          const coroutineState = coroutineStates.get(coroutine);
          const peningLanes = coroutine.resume(lanes, this);

          if (coroutineState !== undefined) {
            coroutineState.pendingLanes = peningLanes;
          }
        }

        if (this._updateFrame.pendingCoroutines.length === 0) {
          break;
        }

        await this._backend.yieldToMain();
      }

      if (!observers.isEmpty()) {
        this._notifyObservers({
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

      if (options.viewTransition) {
        await this._backend.startViewTransition(callback);
      } else {
        await this._backend.requestCallback(callback, {
          priority: 'user-blocking',
        });
      }

      if (passiveEffects.length > 0) {
        await this._backend.requestCallback(
          () => {
            this._commitEffects(passiveEffects, CommitPhase.Passive);
          },
          { priority: 'background' },
        );
      }
    } finally {
      if (!observers.isEmpty()) {
        this._notifyObservers({
          type: 'UPDATE_END',
          id: this._updateFrame.id,
          priority: options.priority,
          viewTransition: options.viewTransition,
        });
      }
    }
  }

  flushSync(): void {
    const { observers } = this._state;

    if (!observers.isEmpty()) {
      this._notifyObservers({
        type: 'UPDATE_START',
        id: this._updateFrame.id,
        priority: null,
        viewTransition: false,
      });
    }

    try {
      if (!observers.isEmpty()) {
        this._notifyObservers({
          type: 'RENDER_START',
          id: this._updateFrame.id,
        });
      }

      do {
        const coroutines = consumeCoroutines(this._updateFrame);

        for (let i = 0, l = coroutines.length; i < l; i++) {
          const coroutine = coroutines[i]!;
          coroutine.resume(Lanes.AllLanes, this);
        }
      } while (this._updateFrame.pendingCoroutines.length > 0);

      if (!observers.isEmpty()) {
        this._notifyObservers({
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
        this._notifyObservers({
          type: 'UPDATE_END',
          id: this._updateFrame.id,
          priority: null,
          viewTransition: false,
        });
      }
    }
  }

  getScope(): Scope {
    return this._scope;
  }

  nextIdentifier(): string {
    const prefix = this._state.templatePlaceholder;
    const id = incrementIdentifier(this._state.identifierCount);
    this._state.identifierCount = id;
    return prefix + ':' + id;
  }

  renderComponent<TProps, TResult>(
    component: Component<TProps, TResult>,
    props: TProps,
    hooks: Hook[],
    lanes: Lanes,
    coroutine: Coroutine,
  ): ComponentResult<TResult> {
    const { observers } = this._state;
    const context = new RenderSession(hooks, lanes, coroutine, this);

    if (!observers.isEmpty()) {
      this._notifyObservers({
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
      this._notifyObservers({
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
      const type = this._backend.resolvePrimitive(value, part);
      type.ensureValue?.(value, part);
      return { type: type as Primitive<T>, value };
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
    const { templatePlaceholder, cachedTemplates } = this._state;
    let template = cachedTemplates.get(strings);

    if (template === undefined) {
      template = this._backend.parseTemplate(
        strings,
        binds,
        templatePlaceholder,
        mode,
      );
      cachedTemplates.set(strings, template);
    }

    return template;
  }

  scheduleUpdate(coroutine: Coroutine, options?: UpdateOptions): UpdateTask {
    const { coroutineStates, updateTasks } = this._state;
    const completeOptions = {
      priority: options?.priority ?? this._backend.getCurrentPriority(),
      viewTransition: options?.viewTransition ?? false,
    };
    const lanes = getScheduleLanesFromOptions(completeOptions);

    for (const updateTask of updateTasks) {
      if (
        updateTask.coroutine === coroutine &&
        updateTask.lanes === lanes &&
        !updateTask.running
      ) {
        return updateTask;
      }
    }

    let coroutineState = coroutineStates.get(coroutine);

    if (coroutineState !== undefined) {
      coroutineState.pendingLanes |= lanes;
    } else {
      coroutineState = { pendingLanes: lanes };
      coroutineStates.set(coroutine, coroutineState);
    }

    const updateTaskNode = updateTasks.pushBack({
      coroutine,
      lanes,
      running: false,
      promise: this._backend.requestCallback(async () => {
        try {
          if ((coroutineState.pendingLanes & lanes) === Lanes.NoLanes) {
            return;
          }

          updateTaskNode.value.running = true;

          await this._createSubcontext(coroutine).flushAsync(completeOptions);
        } finally {
          updateTasks.remove(updateTaskNode);
        }
      }, completeOptions),
    });

    return updateTaskNode.value;
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

  async waitForUpdate(): Promise<number> {
    const updateTasks = Array.from(
      this._state.updateTasks,
      (task) => task.promise,
    );
    const results = await Promise.allSettled(updateTasks);
    return results.length;
  }

  private _commitEffects(effects: Effect[], phase: CommitPhase): void {
    const { observers } = this._state;

    if (!observers.isEmpty()) {
      this._notifyObservers({
        type: 'COMMIT_START',
        id: this._updateFrame.id,
        effects,
        phase,
      });
    }

    this._backend.commitEffects(effects, phase, this);

    if (!observers.isEmpty()) {
      this._notifyObservers({
        type: 'COMMIT_END',
        id: this._updateFrame.id,
        effects,
        phase,
      });
    }
  }

  private _createSubcontext(coroutine: Coroutine): Runtime {
    const id = incrementIdentifier(this._state.updateCount);
    const updateFrame = {
      id,
      pendingCoroutines: [coroutine],
      mutationEffects: [coroutine],
      layoutEffects: [],
      passiveEffects: [],
    };

    this._state.updateCount = id;

    return new Runtime(this._backend, updateFrame, this._scope, this._state);
  }

  private _notifyObservers(event: RuntimeEvent): void {
    for (
      let node = this._state.observers.front();
      node !== null;
      node = node.next
    ) {
      node.value.onRuntimeEvent(event);
    }
  }
}

/**
 * @internal
 */
export function getFlushLanesFromOptions(options: UpdateOptions): Lanes {
  let lanes: Lanes;

  switch (options.priority) {
    case 'user-blocking':
      lanes = Lanes.UserBlockingLane;
      break;
    case 'user-visible':
      lanes = Lanes.UserBlockingLane | Lanes.UserVisibleLane;
      break;
    case 'background':
      lanes =
        Lanes.UserBlockingLane | Lanes.UserVisibleLane | Lanes.BackgroundLane;
      break;
    default:
      lanes = Lanes.DefaultLanes;
      break;
  }

  if (options.viewTransition) {
    lanes |= Lanes.ViewTransitionLane;
  }

  return lanes;
}

/**
 * @internal
 */
export function getScheduleLanesFromOptions(options: UpdateOptions): Lanes {
  let lanes: Lanes;

  switch (options.priority) {
    case 'user-blocking':
      lanes = Lanes.UserBlockingLane;
      break;
    case 'user-visible':
      lanes = Lanes.UserVisibleLane;
      break;
    case 'background':
      lanes = Lanes.BackgroundLane;
      break;
    default:
      lanes = Lanes.DefaultLanes;
      break;
  }

  if (options.viewTransition) {
    lanes |= Lanes.ViewTransitionLane;
  }

  return lanes;
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

function createEmptyUpdateFrame(id: number): UpdateFrame {
  return {
    id,
    pendingCoroutines: [],
    mutationEffects: [],
    layoutEffects: [],
    passiveEffects: [],
  };
}

function createRuntimeState(): RuntimeState {
  return {
    cachedTemplates: new WeakMap(),
    coroutineStates: new WeakMap(),
    identifierCount: 0,
    observers: new LinkedList(),
    templateLiteralPreprocessor: new TemplateLiteralPreprocessor(),
    templatePlaceholder: generateRandomString(8),
    updateCount: 0,
    updateTasks: new LinkedList(),
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
