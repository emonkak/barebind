import { inspectValue } from './debug.js';
import {
  $toDirectiveElement,
  type Component,
  type ComponentResult,
  type Coroutine,
  type Directive,
  type DirectiveElement,
  type Effect,
  type EffectContext,
  isBindableObject,
  type Slot,
  type Template,
  type TemplateMode,
  type UpdateContext,
} from './directive.js';
import type { Hook, Lanes, UpdateTask } from './hook.js';
import {
  ALL_LANES,
  getLanesFromPriority,
  NO_LANES,
  type UpdateOptions,
} from './hook.js';
import { LinkedList } from './linkedList.js';
import { type Part, PartType } from './part.js';
import { CommitPhase, type RenderHost } from './renderHost.js';
import { RenderSession } from './renderSession.js';
import { Scope } from './scope.js';
import {
  type Literal,
  type TemplateLiteral,
  TemplateLiteralPreprocessor,
} from './templateLiteral.js';

export interface RuntimeObserver {
  onRuntimeEvent(event: RuntimeEvent): void;
}

export type RuntimeEvent =
  | {
      type: 'UPDATE_START' | 'UPDATE_END';
      id: number;
      options: UpdateOptions;
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
    };

interface RenderFrame {
  id: number;
  pendingCoroutines: Coroutine[];
  mutationEffects: Effect[];
  layoutEffects: Effect[];
  passiveEffects: Effect[];
}

interface SharedState {
  cachedTemplates: WeakMap<readonly string[], Template<readonly unknown[]>>;
  coroutineStates: WeakMap<Coroutine, CoroutineState>;
  frameCount: number;
  identifierCount: number;
  observers: LinkedList<RuntimeObserver>;
  templateLiteralPreprocessor: TemplateLiteralPreprocessor;
  uniqueIdentifier: string;
}

interface CoroutineState {
  lanes: Lanes;
  pendingTasks: LinkedList<UpdateTask>;
}

export class Runtime implements EffectContext, UpdateContext {
  private readonly _renderHost: RenderHost;

  private readonly _renderFrame: RenderFrame;

  private readonly _currentScope: Scope;

  private readonly _sharedState: SharedState;

  constructor(
    renderHost: RenderHost,
    renderFrame: RenderFrame = createRenderFrame(0),
    currentScope: Scope = new Scope(null),
    sharedState: SharedState = createSharedState(),
  ) {
    this._renderHost = renderHost;
    this._renderFrame = renderFrame;
    this._currentScope = currentScope;
    this._sharedState = sharedState;
  }

  observe(observer: RuntimeObserver): () => void {
    const observers = this._sharedState.observers;
    const node = observers.pushBack(observer);
    return () => {
      observers.remove(node);
    };
  }

  debugValue(directive: Directive<unknown>, value: unknown, part: Part): void {
    if (
      part.type === PartType.ChildNode &&
      (part.node.data === '' ||
        part.node.data.startsWith('/' + directive.name + '('))
    ) {
      part.node.nodeValue = `/${directive.name}(${inspectValue(value)})`;
    }
  }

  enqueueCoroutine(coroutine: Coroutine): void {
    this._renderFrame.pendingCoroutines.push(coroutine);
  }

  enqueueLayoutEffect(effect: Effect): void {
    this._renderFrame.layoutEffects.push(effect);
  }

  enqueueMutationEffect(effect: Effect): void {
    this._renderFrame.mutationEffects.push(effect);
  }

  enqueuePassiveEffect(effect: Effect): void {
    this._renderFrame.passiveEffects.push(effect);
  }

  enterScope(scope: Scope): Runtime {
    return new Runtime(
      this._renderHost,
      this._renderFrame,
      scope,
      this._sharedState,
    );
  }

  expandLiterals<T>(
    strings: TemplateStringsArray,
    values: readonly (T | Literal)[],
  ): TemplateLiteral<T> {
    return this._sharedState.templateLiteralPreprocessor.process(
      strings,
      values,
    );
  }

  async flushAsync(options?: UpdateOptions): Promise<void> {
    const { coroutineStates, observers } = this._sharedState;
    const lanes =
      options?.priority !== undefined
        ? getLanesFromPriority(options.priority)
        : ALL_LANES;

    if (!observers.isEmpty()) {
      this._notifyObservers({
        type: 'UPDATE_START',
        id: this._renderFrame.id,
        options: options ?? {},
      });
    }

    try {
      if (!observers.isEmpty()) {
        this._notifyObservers({
          type: 'RENDER_START',
          id: this._renderFrame.id,
        });
      }

      while (true) {
        const coroutines = consumeCoroutines(this._renderFrame);

        for (let i = 0, l = coroutines.length; i < l; i++) {
          const coroutine = coroutines[i]!;
          const coroutineState = coroutineStates.get(coroutine);
          const nextLanes = coroutine.resume(lanes, this);

          if (coroutineState !== undefined) {
            coroutineState.lanes = nextLanes;
          }
        }

        if (this._renderFrame.pendingCoroutines.length === 0) {
          break;
        }

        await this._renderHost.yieldToMain();
      }

      if (!observers.isEmpty()) {
        this._notifyObservers({
          type: 'RENDER_END',
          id: this._renderFrame.id,
        });
      }

      const { mutationEffects, layoutEffects, passiveEffects } = consumeEffects(
        this._renderFrame,
      );
      const callback = () => {
        this._commitEffects(mutationEffects, CommitPhase.Mutation);
        this._commitEffects(layoutEffects, CommitPhase.Layout);
      };

      if (options?.viewTransition) {
        await this._renderHost.startViewTransition(callback);
      } else {
        await this._renderHost.requestCallback(callback, {
          priority: 'user-blocking',
        });
      }

      if (passiveEffects.length > 0) {
        await this._renderHost.requestCallback(
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
          id: this._renderFrame.id,
          options: options ?? {},
        });
      }
    }
  }

  flushSync(): void {
    const { observers } = this._sharedState;

    if (!observers.isEmpty()) {
      this._notifyObservers({
        type: 'UPDATE_START',
        id: this._renderFrame.id,
        options: {},
      });
    }

    try {
      if (!observers.isEmpty()) {
        this._notifyObservers({
          type: 'RENDER_START',
          id: this._renderFrame.id,
        });
      }

      do {
        const coroutines = consumeCoroutines(this._renderFrame);

        for (let i = 0, l = coroutines.length; i < l; i++) {
          const coroutine = coroutines[i]!;
          coroutine.resume(ALL_LANES, this);
        }
      } while (this._renderFrame.pendingCoroutines.length > 0);

      if (!observers.isEmpty()) {
        this._notifyObservers({
          type: 'RENDER_END',
          id: this._renderFrame.id,
        });
      }

      const { mutationEffects, layoutEffects, passiveEffects } = consumeEffects(
        this._renderFrame,
      );

      this._commitEffects(mutationEffects, CommitPhase.Mutation);
      this._commitEffects(layoutEffects, CommitPhase.Layout);
      this._commitEffects(passiveEffects, CommitPhase.Passive);
    } finally {
      if (!observers.isEmpty()) {
        this._notifyObservers({
          type: 'UPDATE_END',
          id: this._renderFrame.id,
          options: {},
        });
      }
    }
  }

  getCurrentScope(): Scope {
    return this._currentScope;
  }

  nextIdentifier(): string {
    const prefix = this._sharedState.uniqueIdentifier;
    const nextId = incrementId(this._sharedState.identifierCount);
    this._sharedState.identifierCount = nextId;
    return prefix + '-' + nextId;
  }

  renderComponent<TProps, TResult>(
    component: Component<TProps, TResult>,
    props: TProps,
    hooks: Hook[],
    lanes: Lanes,
    coroutine: Coroutine,
  ): ComponentResult<TResult> {
    const { observers } = this._sharedState;
    const session = new RenderSession(hooks, lanes, coroutine, this);

    if (!observers.isEmpty()) {
      this._notifyObservers({
        type: 'COMPONENT_RENDER_START',
        id: this._renderFrame.id,
        component,
        props,
      });
    }

    const result = component.render(props, session);
    const nextLanes = session.finalize();

    if (!observers.isEmpty()) {
      this._notifyObservers({
        type: 'COMPONENT_RENDER_END',
        id: this._renderFrame.id,
        component,
        props,
      });
    }

    return { value: result, lanes: nextLanes };
  }

  resolveDirective(value: unknown, part: Part): DirectiveElement<unknown> {
    if (isBindableObject(value)) {
      return value[$toDirectiveElement](part, this);
    } else {
      const directive = this._renderHost.resolvePrimitive(part);
      directive.ensureValue?.(value, part);
      return { directive, value: value };
    }
  }

  resolveSlot<T>(value: T, part: Part): Slot<T> {
    const element = this.resolveDirective(value, part);
    const binding = element.directive.resolveBinding(element.value, part, this);
    const slotType = element.slotType ?? this._renderHost.resolveSlotType(part);
    return new slotType(binding);
  }

  resolveTemplate(
    strings: readonly string[],
    binds: readonly unknown[],
    mode: TemplateMode,
  ): Template<readonly unknown[]> {
    const { uniqueIdentifier, cachedTemplates } = this._sharedState;
    let template = cachedTemplates.get(strings);

    if (template === undefined) {
      template = this._renderHost.createTemplate(
        strings,
        binds,
        uniqueIdentifier,
        mode,
      );
      cachedTemplates.set(strings, template);
    }

    return template;
  }

  scheduleUpdate(coroutine: Coroutine, options?: UpdateOptions): UpdateTask {
    const { coroutineStates } = this._sharedState;
    const priority = options?.priority ?? this._renderHost.getCurrentPriority();
    let coroutineState = coroutineStates.get(coroutine);

    if (coroutineState === undefined) {
      coroutineState = { lanes: NO_LANES, pendingTasks: new LinkedList() };
      coroutineStates.set(coroutine, coroutineState);
    }

    coroutineState.lanes |= getLanesFromPriority(priority);

    for (const updateTask of coroutineState.pendingTasks) {
      if (updateTask.priority === priority) {
        return updateTask;
      }
    }

    const updateTaskNode = coroutineState.pendingTasks.pushBack({
      priority,
      promise: this._renderHost.requestCallback(
        () => {
          if (coroutineState.lanes === NO_LANES) {
            return;
          }

          coroutineState.pendingTasks.remove(updateTaskNode);

          return this._createSubcontext(coroutine).flushAsync({
            priority,
            viewTransition: options?.viewTransition ?? false,
          });
        },
        { priority },
      ),
    });

    return updateTaskNode.value;
  }

  undebugValue(
    directive: Directive<unknown>,
    _value: unknown,
    part: Part,
  ): void {
    if (
      part.type === PartType.ChildNode &&
      part.node.data.startsWith('/' + directive.name + '(')
    ) {
      part.node.nodeValue = '';
    }
  }

  async waitForUpdate(coroutine: Coroutine): Promise<boolean> {
    const { coroutineStates } = this._sharedState;
    const coroutineState = coroutineStates.get(coroutine);
    if (coroutineState !== undefined) {
      if (!coroutineState.pendingTasks.isEmpty()) {
        const pendingTasks = Array.from(
          coroutineState.pendingTasks,
          (task) => task.promise,
        );
        await Promise.allSettled(pendingTasks);
        return true;
      }
    }
    return false;
  }

  private _commitEffects(effects: Effect[], phase: CommitPhase): void {
    const { observers } = this._sharedState;

    if (!observers.isEmpty()) {
      this._notifyObservers({
        type: 'COMMIT_START',
        id: this._renderFrame.id,
        effects,
        phase,
      });
    }

    this._renderHost.commitEffects(effects, phase, this);

    if (!observers.isEmpty()) {
      this._notifyObservers({
        type: 'COMMIT_END',
        id: this._renderFrame.id,
        effects,
        phase,
      });
    }
  }

  private _createSubcontext(coroutine: Coroutine): Runtime {
    const nextId = incrementId(this._sharedState.frameCount);
    const renderFrame = createRenderFrame(nextId);

    renderFrame.pendingCoroutines.push(coroutine);
    renderFrame.mutationEffects.push(coroutine);

    this._sharedState.frameCount = nextId;

    return new Runtime(
      this._renderHost,
      renderFrame,
      this._currentScope,
      this._sharedState,
    );
  }

  private _notifyObservers(event: RuntimeEvent): void {
    for (
      let node = this._sharedState.observers.front();
      node !== null;
      node = node.next
    ) {
      node.value.onRuntimeEvent(event);
    }
  }
}

function consumeCoroutines(renderFrame: RenderFrame): Coroutine[] {
  const { pendingCoroutines } = renderFrame;
  renderFrame.pendingCoroutines = [];
  return pendingCoroutines;
}

function consumeEffects(
  renderFrame: RenderFrame,
): Pick<RenderFrame, 'mutationEffects' | 'layoutEffects' | 'passiveEffects'> {
  const { mutationEffects, layoutEffects, passiveEffects } = renderFrame;
  renderFrame.mutationEffects = [];
  renderFrame.layoutEffects = [];
  renderFrame.passiveEffects = [];
  return {
    mutationEffects,
    layoutEffects,
    passiveEffects,
  };
}

function createSharedState(): SharedState {
  return {
    cachedTemplates: new WeakMap(),
    coroutineStates: new WeakMap(),
    frameCount: 0,
    identifierCount: 0,
    observers: new LinkedList(),
    templateLiteralPreprocessor: new TemplateLiteralPreprocessor(),
    uniqueIdentifier: generateUniqueIdentifier(8),
  };
}

function createRenderFrame(id: number): RenderFrame {
  return {
    id,
    pendingCoroutines: [],
    mutationEffects: [],
    layoutEffects: [],
    passiveEffects: [],
  };
}

function generateUniqueIdentifier(length: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), (byte) =>
    (byte % 36).toString(36),
  ).join('');
}

function incrementId(id: number): number {
  return (id % Number.MAX_SAFE_INTEGER) + 1;
}
