/// <reference path="../typings/scheduler.d.ts" />

import { inspectValue } from './debug.js';
import {
  $toDirective,
  type CommitContext,
  type Component,
  type ComponentResult,
  type Coroutine,
  type Directive,
  type DirectiveType,
  type Effect,
  isBindable,
  type Primitive,
  type RenderContext,
  type Slot,
  type Template,
  type TemplateMode,
  type UpdateContext,
} from './directive.js';
import type { Hook, Lanes, UpdateTask } from './hook.js';
import {
  ALL_LANES,
  getFlushLanesFromOptions,
  getScheduleLanesFromOptions,
  NO_LANES,
  type UpdateOptions,
} from './hook.js';
import { CommitPhase, type HostEnvironment } from './host-environment.js';
import { LinkedList } from './linked-list.js';
import { type Part, PartType } from './part.js';
import { RenderSession } from './render-session.js';
import { Scope } from './scope.js';
import {
  type Literal,
  type TemplateLiteral,
  TemplateLiteralPreprocessor,
} from './template-literal.js';

export interface RuntimeObserver {
  onRuntimeEvent(event: RuntimeEvent): void;
}

export type RuntimeEvent =
  | {
      type: 'UPDATE_START' | 'UPDATE_END';
      id: number;
      priority: TaskPriority | null;
      transition: boolean;
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
  pendingTasks: LinkedList<UpdateTask>;
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
}

interface UpdateFrame {
  id: number;
  pendingCoroutines: Coroutine[];
  mutationEffects: Effect[];
  layoutEffects: Effect[];
  passiveEffects: Effect[];
}

export class Runtime implements CommitContext, UpdateContext {
  private readonly _host: HostEnvironment;

  private readonly _updateFrame: UpdateFrame;

  private readonly _scope: Scope;

  private readonly _state: RuntimeState;

  constructor(
    host: HostEnvironment,
    updateFrame: UpdateFrame = createEmptyUpdateFrame(0),
    scope: Scope = new Scope(null),
    state: RuntimeState = createRuntimeState(),
  ) {
    this._host = host;
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
        part.node.data.startsWith('/' + type.displayName + '('))
    ) {
      part.node.data = `/${type.displayName}(${inspectValue(value)})`;
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
    return new Runtime(this._host, this._updateFrame, scope, this._state);
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
        transition: options.transition,
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

        await this._host.yieldToMain();
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

      if (options.transition) {
        await this._host.startViewTransition(callback);
      } else {
        await this._host.requestCallback(callback, {
          priority: 'user-blocking',
        });
      }

      if (passiveEffects.length > 0) {
        await this._host.requestCallback(
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
          transition: options.transition,
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
        transition: false,
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
          coroutine.resume(ALL_LANES, this);
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
          transition: false,
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
    return prefix + '-' + id;
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

  resolveDirective<T>(value: T, part: Part): Directive<T> {
    const type = this._host.resolvePrimitive(value, part);
    type.ensureValue?.(value, part);
    return { type: type as Primitive<T>, value };
  }

  resolveSlot<T>(value: T, part: Part): Slot<T> {
    const directive = isBindable(value)
      ? value[$toDirective]()
      : this.resolveDirective(value, part);
    const binding = directive.type.resolveBinding(directive.value, part, this);
    const slotType =
      directive.slotType ?? this._host.resolveSlotType(value, part);
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
      template = this._host.createTemplate(
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
    const { coroutineStates } = this._state;
    const completeOptions = {
      priority: options?.priority ?? this._host.getCurrentPriority(),
      transition: options?.transition ?? false,
    };
    const lanes = getScheduleLanesFromOptions(completeOptions);
    let coroutineState = coroutineStates.get(coroutine);

    if (coroutineState !== undefined) {
      coroutineState.pendingLanes |= lanes;

      for (const task of coroutineState.pendingTasks) {
        if (task.lanes === lanes) {
          return task;
        }
      }
    } else {
      coroutineState = {
        pendingTasks: new LinkedList(),
        pendingLanes: lanes,
      };
      coroutineStates.set(coroutine, coroutineState);
    }

    const taskNode = coroutineState.pendingTasks.pushBack({
      lanes,
      promise: this._host.requestCallback(() => {
        coroutineState.pendingTasks.remove(taskNode);

        if ((coroutineState.pendingLanes & lanes) === NO_LANES) {
          return;
        }

        return this._createSubcontext(coroutine).flushAsync(completeOptions);
      }, completeOptions),
    });

    return taskNode.value;
  }

  undebugValue(
    type: DirectiveType<unknown>,
    _value: unknown,
    part: Part,
  ): void {
    if (
      part.type === PartType.ChildNode &&
      part.node.data.startsWith('/' + type.displayName + '(')
    ) {
      part.node.data = '';
    }
  }

  async waitForUpdate(coroutine: Coroutine): Promise<number> {
    const { coroutineStates } = this._state;
    const coroutineState = coroutineStates.get(coroutine);

    if (coroutineState !== undefined) {
      const pendingTasks = Iterator.from(coroutineState.pendingTasks).map(
        (task) => task.promise,
      );
      const results = await Promise.allSettled(pendingTasks);
      return results.length;
    }

    return 0;
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

    this._host.commitEffects(effects, phase, this);

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

    return new Runtime(this._host, updateFrame, this._scope, this._state);
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
