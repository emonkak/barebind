import {
  type Bindable,
  type BindableElement,
  BindableType,
  type Component,
  type Effect,
  type ResumableBinding,
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
import type { Primitive } from './primitives/primitive.js';
import { RenderEngine } from './renderEngine.js';
import { CommitPhase, type RenderHost } from './renderHost.js';
import {
  type TemplateLiteral,
  TemplateLiteralPreprocessor,
} from './templateLiteral.js';

interface RenderFrame {
  suspendedBindings: ResumableBinding<unknown>[];
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
  dirtyBindings: Set<ResumableBinding<unknown>>;
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

  createMarkerNode(): ChildNode {
    return this._renderHost.createMarkerNode();
  }

  enqueueBinding(binding: ResumableBinding<unknown>): void {
    this._renderFrame.suspendedBindings.push(binding);
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
    const { dirtyBindings } = this._globalState;
    const promises = [];

    while (true) {
      const suspendedBindings = consumeSuspendedBindings(this._renderFrame);

      for (let i = 0, l = suspendedBindings.length; i < l; i++) {
        const suspendedBinding = suspendedBindings[i]!;
        const promise = suspendedBinding.resume(this);
        if (promise !== undefined) {
          promises.push(promise);
        }
        dirtyBindings.delete(suspendedBinding);
      }

      if (promises.length > 0) {
        await Promise.allSettled(promises);
        promises.length = 0;
      }

      if (this._renderFrame.suspendedBindings.length === 0) {
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
    binding: ResumableBinding<TProps>,
  ): Bindable<TResult> {
    const updateContext = new UpdateEngine(
      this._renderHost,
      createRenderFrame(),
      this._contextualScope?.parent,
      this._globalState,
    );
    const renderContext = new RenderEngine(hooks, binding, updateContext);
    const element = component(props, renderContext);
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

  scheduleUpdate(
    binding: ResumableBinding<unknown>,
    options?: UpdateOptions,
  ): Promise<void> {
    const { dirtyBindings } = this._globalState;
    if (dirtyBindings.has(binding)) {
      return Promise.resolve();
    }
    dirtyBindings.add(binding);
    return this._renderHost.requestCallback(
      async () => {
        if (!dirtyBindings.has(binding)) {
          return;
        }
        this._renderFrame.suspendedBindings.push(binding);
        this._renderFrame.mutationEffects.push(binding);
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

function consumeSuspendedBindings(
  renderFrame: RenderFrame,
): ResumableBinding<unknown>[] {
  const { suspendedBindings } = renderFrame;
  renderFrame.suspendedBindings = [];
  return suspendedBindings;
}

function createGlobalState(): GlobalState {
  return {
    cachedTemplates: new WeakMap(),
    dirtyBindings: new Set(),
    identifierCount: 0,
    templateLiteralPreprocessor: new TemplateLiteralPreprocessor(),
  };
}

function createRenderFrame(): RenderFrame {
  return {
    suspendedBindings: [],
    mutationEffects: [],
    layoutEffects: [],
    passiveEffects: [],
  };
}
