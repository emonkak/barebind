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
import { Lane, NO_LANES, type UpdateOptions } from './hook.js';
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
  coroutines: Coroutine[];
  mutationEffects: Effect[];
  layoutEffects: Effect[];
  passiveEffects: Effect[];
}

interface GlobalState {
  cachedTemplates: WeakMap<
    readonly string[],
    Template<readonly Bindable<unknown>[]>
  >;
  identifierCount: number;
  updateStates: WeakMap<Coroutine, UpdateState>;
  templateLiteralPreprocessor: TemplateLiteralPreprocessor;
  uniqueIdentifier: string;
}

interface UpdateState {
  lanes: Lanes;
  pendingTasks: LinkedList<UpdateTask>;
}

interface ContextualEntry<T> {
  key: unknown;
  value: T;
}

interface ContextualScope {
  parent: ContextualScope | null;
  context: UpdateContext;
  entries: ContextualEntry<unknown>[];
}

export class UpdateEngine implements UpdateContext {
  private readonly _renderHost: RenderHost;

  private readonly _renderFrame: RenderFrame;

  private _contextualScope: ContextualScope | null;

  private readonly _globalState: GlobalState;

  constructor(
    renderHost: RenderHost,
    renderFrame: RenderFrame = createRenderFrame(),
    contextualScope: ContextualScope | null = null,
    globalState = createGlobalState(),
  ) {
    this._renderHost = renderHost;
    this._renderFrame = renderFrame;
    this._contextualScope = contextualScope;
    this._globalState = globalState;
  }

  clone(): UpdateContext {
    return new UpdateEngine(
      this._renderHost,
      createRenderFrame(),
      this._contextualScope,
      this._globalState,
    );
  }

  enqueueCoroutine(coroutine: Coroutine): void {
    this._renderFrame.coroutines.push(coroutine);
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
    return this._globalState.templateLiteralPreprocessor.expandLiterals(
      strings,
      values,
    );
  }

  async flushAsync(options?: UpdateOptions): Promise<void> {
    const { updateStates } = this._globalState;
    const lane = Lane[options?.priority ?? 'default'];

    while (true) {
      const coroutines = consumeCoroutines(this._renderFrame);

      for (let i = 0, l = coroutines.length; i < l; i++) {
        const coroutine = coroutines[i]!;
        const updateState = updateStates.get(coroutine);
        const nextLanes = coroutine.resume(lane, this);

        if (updateState !== undefined) {
          updateState.lanes = nextLanes;
        }
      }

      if (this._renderFrame.coroutines.length === 0) {
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
        coroutine.resume(Lane.default, this);
      }
    } while (this._renderFrame.coroutines.length > 0);

    const { mutationEffects, layoutEffects, passiveEffects } = consumeEffects(
      this._renderFrame,
    );

    this._renderHost.commitEffects(mutationEffects, CommitPhase.Mutation);
    this._renderHost.commitEffects(layoutEffects, CommitPhase.Layout);
    this._renderHost.commitEffects(passiveEffects, CommitPhase.Passive);
  }

  getContextualValue<T>(key: unknown): T | undefined {
    let contextualScope = this._contextualScope;
    while (contextualScope !== null) {
      const entry = contextualScope.entries.findLast(
        (entry) => entry.key === key,
      );
      if (entry !== undefined) {
        return entry.value as T;
      }
      contextualScope = contextualScope.parent;
    }
    return undefined;
  }

  getTemplate(
    strings: readonly string[],
    binds: readonly Bindable<unknown>[],
    mode: TemplateMode,
  ): Template<readonly Bindable<unknown>[]> {
    let template = this._globalState.cachedTemplates.get(strings);

    if (template === undefined) {
      template = this._renderHost.createTemplate(
        strings,
        binds,
        this._globalState.uniqueIdentifier,
        mode,
      );
      this._globalState.cachedTemplates.set(strings, template);
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
    const prefix = this._globalState.uniqueIdentifier;
    const count = ++this._globalState.identifierCount;
    return prefix + '-' + count;
  }

  renderComponent<TProps, TResult>(
    component: Component<TProps, TResult>,
    props: TProps,
    hooks: Hook[],
    lane: Lane,
    coroutine: Coroutine,
  ): RenderResult<TResult> {
    const updateContext = new UpdateEngine(
      this._renderHost,
      createRenderFrame(),
      this._contextualScope?.parent,
      this._globalState,
    );
    const renderContext = new RenderEngine(
      hooks,
      lane,
      coroutine,
      updateContext,
    );
    const result = component.render(props, renderContext);
    const lanes = renderContext.finalize();
    return { result, lanes };
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

  setContextualValue<T>(key: unknown, value: T): void {
    if (this._contextualScope?.context !== this) {
      this._contextualScope = {
        parent: this._contextualScope,
        context: this,
        entries: [{ key, value }],
      };
    } else {
      this._contextualScope.entries.push({ key, value });
    }
  }

  scheduleUpdate(coroutine: Coroutine, options?: UpdateOptions): UpdateTask {
    const { updateStates } = this._globalState;
    const priority = options?.priority ?? this._renderHost.getTaskPriority();
    const lane = Lane[priority];
    let updateState = updateStates.get(coroutine);

    if (updateState === undefined) {
      updateState = { lanes: NO_LANES, pendingTasks: new LinkedList() };
      updateStates.set(coroutine, updateState);
    }

    updateState.lanes |= lane;

    for (const updateTask of updateState.pendingTasks) {
      if (updateTask.priority === priority) {
        return updateTask;
      }
    }

    const updateTaskNode = updateState.pendingTasks.pushBack({
      priority,
      promise: this._renderHost.requestCallback(
        () => {
          updateState.pendingTasks.remove(updateTaskNode);

          if (updateState.lanes === NO_LANES) {
            return;
          }

          this._renderFrame.coroutines.push(coroutine);
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
  const { coroutines } = renderFrame;
  renderFrame.coroutines = [];
  return coroutines;
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

function createGlobalState(): GlobalState {
  return {
    cachedTemplates: new WeakMap(),
    identifierCount: 0,
    updateStates: new WeakMap(),
    templateLiteralPreprocessor: new TemplateLiteralPreprocessor(),
    uniqueIdentifier: generateUniqueIdentifier(8),
  };
}

function createRenderFrame(): RenderFrame {
  return {
    coroutines: [],
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
