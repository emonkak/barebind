import {
  type Bindable,
  type BindableElement,
  BindableType,
  type Component,
  type Coroutine,
  type Effect,
  type Primitive,
  type Slot,
  type Template,
  type TemplateBlock,
  type TemplateMode,
  type UpdateContext,
  bindableTag,
} from './core.js';
import type { UpdateOptions } from './hook.js';
import type { Hook } from './hook.js';
import type { Part } from './part.js';
import { RenderEngine } from './renderEngine.js';
import { CommitPhase, type RenderHost } from './renderHost.js';
import {
  type TemplateLiteral,
  TemplateLiteralPreprocessor,
} from './templateLiteral.js';

interface RenderFrame {
  coroutines: Coroutine[];
  mutationEffects: Effect[];
  layoutEffects: Effect[];
  passiveEffects: Effect[];
}

interface ContextualScope {
  parent: ContextualScope | null;
  context: UpdateContext;
  entries: ContextualEntry<unknown>[];
}

interface ContextualEntry<T> {
  key: unknown;
  value: T;
}

interface GlobalState {
  cachedTemplates: WeakMap<
    readonly string[],
    Template<readonly Bindable<unknown>[]>
  >;
  dirtyCoroutines: Set<Coroutine>;
  identifierCount: number;
  templateLiteralPreprocessor: TemplateLiteralPreprocessor;
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

  createMarkerNode(): Comment {
    return this._renderHost.createMarkerNode();
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

  expandLiterals(
    strings: TemplateStringsArray,
    values: readonly unknown[],
  ): TemplateLiteral {
    return this._globalState.templateLiteralPreprocessor.expandLiterals(
      strings,
      values,
    );
  }

  async flushFrame(options?: UpdateOptions): Promise<void> {
    const { dirtyCoroutines } = this._globalState;

    while (true) {
      const coroutines = consumeCoroutines(this._renderFrame);

      for (let i = 0, l = coroutines.length; i < l; i++) {
        const coroutine = coroutines[i]!;
        coroutine.resume(this);
        dirtyCoroutines.delete(coroutine);
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
        priority: options?.priority ?? 'user-blocking',
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
      template = this._renderHost.createTemplate(strings, binds, mode);
      this._globalState.cachedTemplates.set(strings, template);
    }

    return template;
  }

  nextIdentifier(): string {
    return (
      ':' +
      this._renderHost.getTemplatePlaceholder() +
      '-' +
      ++this._globalState.identifierCount +
      ':'
    );
  }

  renderComponent<TProps, TResult>(
    component: Component<TProps, TResult>,
    props: TProps,
    hooks: Hook[],
    coroutine: Coroutine,
  ): Bindable<TResult> {
    const updateContext = new UpdateEngine(
      this._renderHost,
      createRenderFrame(),
      this._contextualScope?.parent,
      this._globalState,
    );
    const renderContext = new RenderEngine(hooks, coroutine, updateContext);
    const element = component.render(props, renderContext);
    renderContext.finalize();
    return element;
  }

  renderTemplate<TBinds>(
    template: Template<TBinds>,
    binds: TBinds,
  ): TemplateBlock<TBinds> {
    return template.render(binds, this);
  }

  resolveSlot<T>(value: Bindable<T>, part: Part): Slot<T> {
    const element = this.resolveDirective(value, part);
    const binding = element.directive.resolveBinding(element.value, part, this);
    const slotType = element.slotType ?? this._renderHost.resolveSlotType(part);
    return new slotType(binding);
  }

  resolveDirective<T>(value: Bindable<T>, part: Part): BindableElement<T> {
    switch (value?.[bindableTag]) {
      case BindableType.DirectiveElement:
        return value;
      case BindableType.DirectiveValue:
        return { directive: value.directive, value };
      case BindableType.SlotElement:
        const element = this.resolveDirective(value.value, part);
        return {
          directive: element.directive,
          value: element.value,
          slotType: value.slotType,
        };
      default: {
        type EnsureValue = (value: unknown, part: Part) => void;
        const directive = this._renderHost.resolvePrimitive(
          part,
        ) as Primitive<T>;
        (directive.ensureValue as EnsureValue)(value, part);
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

  scheduleUpdate(coroutine: Coroutine, options?: UpdateOptions): Promise<void> {
    const { dirtyCoroutines } = this._globalState;
    if (dirtyCoroutines.has(coroutine)) {
      return Promise.resolve();
    }
    dirtyCoroutines.add(coroutine);
    return this._renderHost.requestCallback(
      async () => {
        if (!dirtyCoroutines.has(coroutine)) {
          return;
        }
        this._renderFrame.coroutines.push(coroutine);
        this._renderFrame.mutationEffects.push(coroutine);
        await this.flushFrame(options);
      },
      { priority: options?.priority ?? this._renderHost.getTaskPriority() },
    );
  }
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

function consumeCoroutines(renderFrame: RenderFrame): Coroutine[] {
  const { coroutines } = renderFrame;
  renderFrame.coroutines = [];
  return coroutines;
}

function createGlobalState(): GlobalState {
  return {
    cachedTemplates: new WeakMap(),
    dirtyCoroutines: new Set(),
    identifierCount: 0,
    templateLiteralPreprocessor: new TemplateLiteralPreprocessor(),
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
