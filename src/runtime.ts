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

interface Environment {
  backend: Backend;
  cachedTemplates: WeakMap<readonly string[], Template<readonly unknown[]>>;
  coroutineStates: WeakMap<Coroutine, CoroutineState>;
  identifierCount: number;
  observers: LinkedList<RuntimeObserver>;
  scheduledTasks: LinkedList<UpdateTask>;
  templateLiteralPreprocessor: TemplateLiteralPreprocessor;
  templatePlaceholder: string;
  updateCount: number;
}

interface Frame {
  id: number;
  pendingCoroutines: Coroutine[];
  mutationEffects: Effect[];
  layoutEffects: Effect[];
  passiveEffects: Effect[];
}

export class Runtime implements CommitContext, UpdateContext {
  private readonly _frame: Frame;

  private readonly _scope: Scope;

  private readonly _environment: Environment;

  static create(backend: Backend): Runtime {
    const frame: Frame = {
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
      coroutineStates: new WeakMap(),
      identifierCount: 0,
      observers: new LinkedList(),
      scheduledTasks: new LinkedList(),
      templateLiteralPreprocessor: new TemplateLiteralPreprocessor(),
      templatePlaceholder: generateRandomString(8),
      updateCount: 0,
    };
    return new Runtime(frame, scope, environment);
  }

  private constructor(frame: Frame, scope: Scope, environment: Environment) {
    this._frame = frame;
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
    this._frame.pendingCoroutines.push(coroutine);
  }

  enqueueLayoutEffect(effect: Effect): void {
    this._frame.layoutEffects.push(effect);
  }

  enqueueMutationEffect(effect: Effect): void {
    this._frame.mutationEffects.push(effect);
  }

  enqueuePassiveEffect(effect: Effect): void {
    this._frame.passiveEffects.push(effect);
  }

  enterScope(scope: Scope): Runtime {
    return new Runtime(this._frame, scope, this._environment);
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

  async flushAsync(options: Required<UpdateOptions>): Promise<void> {
    const { coroutineStates, backend, observers } = this._environment;
    const lanes = getFlushLanesFromOptions(options);

    if (!observers.isEmpty()) {
      this._notifyObservers({
        type: 'UPDATE_START',
        id: this._frame.id,
        priority: options.priority,
        viewTransition: options.viewTransition,
      });
    }

    try {
      if (!observers.isEmpty()) {
        this._notifyObservers({
          type: 'RENDER_START',
          id: this._frame.id,
        });
      }

      while (true) {
        const coroutines = consumeCoroutines(this._frame);

        for (let i = 0, l = coroutines.length; i < l; i++) {
          const coroutine = coroutines[i]!;
          const coroutineState = coroutineStates.get(coroutine);
          const peningLanes = coroutine.resume(lanes, this);

          if (coroutineState !== undefined) {
            coroutineState.pendingLanes = peningLanes;
          }
        }

        if (this._frame.pendingCoroutines.length === 0) {
          break;
        }

        await backend.yieldToMain();
      }

      if (!observers.isEmpty()) {
        this._notifyObservers({
          type: 'RENDER_END',
          id: this._frame.id,
        });
      }

      const { mutationEffects, layoutEffects, passiveEffects } = consumeEffects(
        this._frame,
      );
      const callback = () => {
        this._commitEffects(mutationEffects, CommitPhase.Mutation);
        this._commitEffects(layoutEffects, CommitPhase.Layout);
      };

      if (options.viewTransition) {
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
        this._notifyObservers({
          type: 'UPDATE_END',
          id: this._frame.id,
          priority: options.priority,
          viewTransition: options.viewTransition,
        });
      }
    }
  }

  flushSync(): void {
    const { observers } = this._environment;

    if (!observers.isEmpty()) {
      this._notifyObservers({
        type: 'UPDATE_START',
        id: this._frame.id,
        priority: null,
        viewTransition: false,
      });
    }

    try {
      if (!observers.isEmpty()) {
        this._notifyObservers({
          type: 'RENDER_START',
          id: this._frame.id,
        });
      }

      do {
        const coroutines = consumeCoroutines(this._frame);

        for (let i = 0, l = coroutines.length; i < l; i++) {
          const coroutine = coroutines[i]!;
          coroutine.resume(Lanes.AllLanes, this);
        }
      } while (this._frame.pendingCoroutines.length > 0);

      if (!observers.isEmpty()) {
        this._notifyObservers({
          type: 'RENDER_END',
          id: this._frame.id,
        });
      }

      const { mutationEffects, layoutEffects, passiveEffects } = consumeEffects(
        this._frame,
      );

      this._commitEffects(mutationEffects, CommitPhase.Mutation);
      this._commitEffects(layoutEffects, CommitPhase.Layout);
      this._commitEffects(passiveEffects, CommitPhase.Passive);
    } finally {
      if (!observers.isEmpty()) {
        this._notifyObservers({
          type: 'UPDATE_END',
          id: this._frame.id,
          priority: null,
          viewTransition: false,
        });
      }
    }
  }

  getScheduledTasks(): LinkedList<UpdateTask> {
    return this._environment.scheduledTasks;
  }

  getScope(): Scope {
    return this._scope;
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
      this._notifyObservers({
        type: 'COMPONENT_RENDER_START',
        id: this._frame.id,
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
        id: this._frame.id,
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

  scheduleUpdate(coroutine: Coroutine, options?: UpdateOptions): UpdateTask {
    const { backend, coroutineStates, scheduledTasks } = this._environment;
    const completeOptions = {
      priority: options?.priority ?? backend.getCurrentPriority(),
      viewTransition: options?.viewTransition ?? false,
    };
    const lanes = getScheduleLanesFromOptions(completeOptions);

    for (const scheduledTask of scheduledTasks) {
      if (
        scheduledTask.coroutine === coroutine &&
        scheduledTask.lanes === lanes &&
        !scheduledTask.running
      ) {
        return scheduledTask;
      }
    }

    let coroutineState = coroutineStates.get(coroutine);

    if (coroutineState !== undefined) {
      coroutineState.pendingLanes |= lanes;
    } else {
      coroutineState = { pendingLanes: lanes };
      coroutineStates.set(coroutine, coroutineState);
    }

    const scheduledTaskNode = scheduledTasks.pushBack({
      coroutine,
      lanes,
      running: false,
      promise: backend.requestCallback(async () => {
        try {
          if ((coroutineState.pendingLanes & lanes) === Lanes.NoLanes) {
            return;
          }

          scheduledTaskNode.value.running = true;

          await this._createSubcontext(coroutine).flushAsync(completeOptions);
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
      this._notifyObservers({
        type: 'COMMIT_START',
        id: this._frame.id,
        effects,
        phase,
      });
    }

    backend.commitEffects(effects, phase, this);

    if (!observers.isEmpty()) {
      this._notifyObservers({
        type: 'COMMIT_END',
        id: this._frame.id,
        effects,
        phase,
      });
    }
  }

  private _createSubcontext(coroutine: Coroutine): Runtime {
    const id = incrementIdentifier(this._environment.updateCount);
    const updateFrame = {
      id,
      pendingCoroutines: [coroutine],
      mutationEffects: [coroutine],
      layoutEffects: [],
      passiveEffects: [],
    };

    this._environment.updateCount = id;

    return new Runtime(updateFrame, this._scope, this._environment);
  }

  private _notifyObservers(event: RuntimeEvent): void {
    for (
      let node = this._environment.observers.front();
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

function consumeCoroutines(updateFrame: Frame): Coroutine[] {
  const { pendingCoroutines } = updateFrame;
  updateFrame.pendingCoroutines = [];
  return pendingCoroutines;
}

function consumeEffects(
  updateFrame: Frame,
): Pick<Frame, 'mutationEffects' | 'layoutEffects' | 'passiveEffects'> {
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
