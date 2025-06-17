import {
  type Bindable,
  type BindableElement,
  BindableType,
  type Component,
  type Coroutine,
  type Effect,
  type Primitive,
  type RenderResult,
  type Slot,
  type Template,
  type TemplateBlock,
  type TemplateMode,
  type UpdateContext,
  bindableTypeTag,
} from './core.js';
import {
  ALL_LANES,
  NO_LANES,
  type UpdateOptions,
  getLanesFromPriority,
} from './hook.js';
import type { Hook, Lanes, UpdateTask } from './hook.js';
import type { HydrationTree } from './hydration.js';
import { LinkedList } from './linkedList.js';
import type { ChildNodePart, Part } from './part.js';
import { RenderEngine } from './renderEngine.js';
import { CommitPhase, type RenderHost } from './renderHost.js';
import {
  type Literal,
  type TemplateLiteral,
  TemplateLiteralPreprocessor,
} from './templateLiteral.js';

interface RenderFrame {
  pendingCoroutines: Coroutine[];
  mutationEffects: Effect[];
  layoutEffects: Effect[];
  passiveEffects: Effect[];
}

interface ContextScope {
  parent: ContextScope | null;
  entries: ContextEntry<unknown>[];
}

interface ContextEntry<T> {
  key: unknown;
  value: T;
}

interface SharedState {
  cachedTemplates: WeakMap<
    readonly string[],
    Template<readonly Bindable<unknown>[]>
  >;
  coroutineStates: WeakMap<Coroutine, CoroutineState>;
  identifierCount: number;
  templateLiteralPreprocessor: TemplateLiteralPreprocessor;
  uniqueIdentifier: string;
}

interface CoroutineState {
  lanes: Lanes;
  pendingTasks: LinkedList<UpdateTask>;
}

export class UpdateEngine implements UpdateContext {
  private readonly _renderHost: RenderHost;

  private readonly _renderFrame: RenderFrame;

  private readonly _contextScope: ContextScope;

  private readonly _sharedState: SharedState;

  constructor(
    renderHost: RenderHost,
    renderFrame: RenderFrame = createRenderFrame(),
    contextScope: ContextScope = createContextScope(null),
    sharedState = createSharedState(),
  ) {
    this._renderHost = renderHost;
    this._renderFrame = renderFrame;
    this._contextScope = contextScope;
    this._sharedState = sharedState;
  }

  createIsolatedContext(): UpdateContext {
    return new UpdateEngine(
      this._renderHost,
      createRenderFrame(),
      createContextScope(this._contextScope.parent),
      this._sharedState,
    );
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

  expandLiterals<T>(
    strings: TemplateStringsArray,
    values: readonly (T | Literal)[],
  ): TemplateLiteral<T> {
    return this._sharedState.templateLiteralPreprocessor.expandLiterals(
      strings,
      values,
    );
  }

  async flushAsync(options?: UpdateOptions): Promise<void> {
    const { coroutineStates } = this._sharedState;
    const lanes =
      options?.priority !== undefined
        ? getLanesFromPriority(options.priority)
        : ALL_LANES;

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

    const { mutationEffects, layoutEffects, passiveEffects } = consumeEffects(
      this._renderFrame,
    );
    const callback = () => {
      this._renderHost.commitEffects(mutationEffects, CommitPhase.Mutation);
      this._renderHost.commitEffects(layoutEffects, CommitPhase.Layout);
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
          this._renderHost.commitEffects(passiveEffects, CommitPhase.Passive);
        },
        { priority: 'background' },
      );
    }
  }

  flushSync(): void {
    do {
      const coroutines = consumeCoroutines(this._renderFrame);

      for (let i = 0, l = coroutines.length; i < l; i++) {
        const coroutine = coroutines[i]!;
        coroutine.resume(ALL_LANES, this);
      }
    } while (this._renderFrame.pendingCoroutines.length > 0);

    const { mutationEffects, layoutEffects, passiveEffects } = consumeEffects(
      this._renderFrame,
    );

    this._renderHost.commitEffects(mutationEffects, CommitPhase.Mutation);
    this._renderHost.commitEffects(layoutEffects, CommitPhase.Layout);
    this._renderHost.commitEffects(passiveEffects, CommitPhase.Passive);
  }

  getContextValue(key: unknown): unknown {
    let contextScope: ContextScope | null = this._contextScope;
    do {
      const entry = contextScope.entries.findLast((entry) => entry.key === key);
      if (entry !== undefined) {
        return entry.value;
      }
      contextScope = contextScope.parent;
    } while (contextScope !== null);
    return undefined;
  }

  getTemplate(
    strings: readonly string[],
    binds: readonly Bindable<unknown>[],
    mode: TemplateMode,
  ): Template<readonly Bindable<unknown>[]> {
    let template = this._sharedState.cachedTemplates.get(strings);

    if (template === undefined) {
      template = this._renderHost.createTemplate(
        strings,
        binds,
        this._sharedState.uniqueIdentifier,
        mode,
      );
      this._sharedState.cachedTemplates.set(strings, template);
    }

    return template;
  }

  hydrateTemplate<TBinds extends readonly Bindable<unknown>[]>(
    template: Template<TBinds>,
    binds: TBinds,
    part: ChildNodePart,
    hydrationTree: HydrationTree,
  ): TemplateBlock<TBinds> {
    return template.hydrate(binds, part, hydrationTree, this);
  }

  nextIdentifier(): string {
    const prefix = this._sharedState.uniqueIdentifier;
    const count = ++this._sharedState.identifierCount;
    return prefix + '-' + count;
  }

  renderComponent<TProps, TResult>(
    component: Component<TProps, TResult>,
    props: TProps,
    hooks: Hook[],
    lanes: Lanes,
    coroutine: Coroutine,
  ): RenderResult<TResult> {
    const updateContext = new UpdateEngine(
      this._renderHost,
      createRenderFrame(),
      createContextScope(this._contextScope),
      this._sharedState,
    );
    const renderContext = new RenderEngine(
      hooks,
      lanes,
      coroutine,
      updateContext,
    );
    const result = component.render(props, renderContext);
    const nextLanes = renderContext.finalize();
    return { result, lanes: nextLanes };
  }

  renderTemplate<TBinds extends readonly Bindable<unknown>[]>(
    template: Template<TBinds>,
    binds: TBinds,
    part: ChildNodePart,
  ): TemplateBlock<TBinds> {
    return template.render(binds, part, this);
  }

  resolveSlot<T>(value: Bindable<T>, part: Part): Slot<T> {
    const element = this.resolveDirective(value, part);
    const binding = element.directive.resolveBinding(element.value, part, this);
    const slotType = element.slotType ?? this._renderHost.resolveSlotType(part);
    return new slotType(binding);
  }

  resolveDirective<T>(value: Bindable<T>, part: Part): BindableElement<T> {
    switch (value?.[bindableTypeTag]) {
      case BindableType.DirectiveElement:
        return value;
      case BindableType.DirectiveObject:
        return { directive: value.directive, value };
      case BindableType.SlotElement:
        const element = this.resolveDirective(value.value, part);
        return {
          directive: element.directive,
          value: element.value,
          slotType: value.slotType,
        };
      default: {
        const directive = this._renderHost.resolvePrimitive(
          part,
        ) as Primitive<T>;
        directive.ensureValue?.(value, part);
        return { directive, value };
      }
    }
  }

  setContextValue(key: unknown, value: unknown): void {
    this._contextScope.entries.push({ key, value });
  }

  scheduleUpdate(coroutine: Coroutine, options?: UpdateOptions): UpdateTask {
    const { coroutineStates } = this._sharedState;
    const priority =
      options?.priority ?? this._renderHost.getCurrentTaskPriority();
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
          coroutineState.pendingTasks.remove(updateTaskNode);

          if (coroutineState.lanes === NO_LANES) {
            return;
          }

          this._renderFrame.pendingCoroutines.push(coroutine);
          this._renderFrame.mutationEffects.push(coroutine);

          return this.flushAsync({
            priority,
            viewTransition: options?.viewTransition ?? false,
          });
        },
        { priority },
      ),
    });

    return updateTaskNode.value;
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
    identifierCount: 0,
    templateLiteralPreprocessor: new TemplateLiteralPreprocessor(),
    uniqueIdentifier: generateUniqueIdentifier(8),
  };
}

function createRenderFrame(): RenderFrame {
  return {
    pendingCoroutines: [],
    mutationEffects: [],
    layoutEffects: [],
    passiveEffects: [],
  };
}

function createContextScope(parent: ContextScope | null): ContextScope {
  return {
    parent,
    entries: [],
  };
}

function generateUniqueIdentifier(length: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), (byte) =>
    (byte % 36).toString(36),
  ).join('');
}
