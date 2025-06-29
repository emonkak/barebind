import {
  $toDirectiveElement,
  type Bindable,
  type Component,
  type Coroutine,
  type DirectiveElement,
  type Effect,
  isBindableObject,
  type Primitive,
  type RenderResult,
  type Slot,
  type Template,
  type TemplateBlock,
  type TemplateMode,
  type UpdateContext,
} from './directive.js';
import type { Hook, Lanes, UpdateTask } from './hook.js';
import {
  ALL_LANES,
  CommitPhase,
  getLanesFromPriority,
  NO_LANES,
  type UpdateOptions,
} from './hook.js';
import type { HydrationTree } from './hydration.js';
import { LinkedList } from './linkedList.js';
import type { ChildNodePart, Part } from './part.js';
import { RenderEngine } from './renderEngine.js';
import type { RenderHost } from './renderHost.js';
import { Scope } from './scope.js';
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

  private readonly _currentScope: Scope;

  private readonly _sharedState: SharedState;

  constructor(
    renderHost: RenderHost,
    renderFrame: RenderFrame = createRenderFrame(),
    currentScope: Scope = new Scope(null),
    sharedState: SharedState = createSharedState(),
  ) {
    this._renderHost = renderHost;
    this._renderFrame = renderFrame;
    this._currentScope = currentScope;
    this._sharedState = sharedState;
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

  enterRenderFrame(): UpdateEngine {
    return new UpdateEngine(
      this._renderHost,
      createRenderFrame(),
      this._currentScope,
      this._sharedState,
    );
  }

  enterScope(scope: Scope): UpdateEngine {
    return new UpdateEngine(
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

  getCurrentScope(): Scope {
    return this._currentScope;
  }

  hydrateTemplate<TBinds extends readonly Bindable<unknown>[]>(
    template: Template<TBinds>,
    binds: TBinds,
    part: ChildNodePart,
    hydrationTree: HydrationTree,
  ): TemplateBlock {
    return template.hydrate(binds, part, hydrationTree, this);
  }

  isPending(): boolean {
    const {
      pendingCoroutines,
      mutationEffects,
      layoutEffects,
      passiveEffects,
    } = this._renderFrame;
    return (
      pendingCoroutines.length > 0 ||
      mutationEffects.length > 0 ||
      layoutEffects.length > 0 ||
      passiveEffects.length > 0
    );
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
    const context = new RenderEngine(hooks, lanes, coroutine, this);
    const result = component.render(props, context);
    const nextLanes = context.finalize();
    return { result, lanes: nextLanes };
  }

  renderTemplate<TBinds extends readonly Bindable<unknown>[]>(
    template: Template<TBinds>,
    binds: TBinds,
    part: ChildNodePart,
  ): TemplateBlock {
    return template.render(binds, part, this);
  }

  resolveSlot<T>(value: Bindable<T>, part: Part): Slot<T> {
    const element = this.resolveDirective(value, part);
    const binding = element.directive.resolveBinding(element.value, part, this);
    const slotType = element.slotType ?? this._renderHost.resolveSlotType(part);
    return new slotType(binding);
  }

  resolveDirective<T>(value: Bindable<T>, part: Part): DirectiveElement<T> {
    if (isBindableObject(value)) {
      return value[$toDirectiveElement](part, this);
    } else {
      const directive = this._renderHost.resolvePrimitive(part) as Primitive<T>;
      directive.ensureValue?.(value, part);
      return { directive, value: value };
    }
  }

  resolveTemplate(
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
          if (coroutineState.lanes === NO_LANES) {
            return;
          }

          coroutineState.pendingTasks.remove(updateTaskNode);

          const subcontext = this.enterRenderFrame();

          subcontext._renderFrame.pendingCoroutines.push(coroutine);
          subcontext._renderFrame.mutationEffects.push(coroutine);

          return subcontext.flushAsync({
            priority,
            viewTransition: options?.viewTransition ?? false,
          });
        },
        { priority },
      ),
    });

    return updateTaskNode.value;
  }

  async waitForUpdate(coroutine: Coroutine): Promise<void> {
    const { coroutineStates } = this._sharedState;
    const coroutineState = coroutineStates.get(coroutine);
    if (coroutineState !== undefined) {
      await Promise.allSettled(
        Array.from(coroutineState.pendingTasks, (task) => task.promise),
      );
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

function generateUniqueIdentifier(length: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), (byte) =>
    (byte % 36).toString(36),
  ).join('');
}
