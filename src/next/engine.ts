import { dependenciesAreChanged } from './compare.js';
import {
  type Bindable,
  type Binding,
  type Component,
  type DirectiveElement,
  type Effect,
  type RenderContext,
  type Template,
  type TemplateBlock,
  type TemplateMode,
  type UpdateContext,
  createDirectiveElement,
  isDirectiveElement,
  isDirectiveObject,
} from './directive.js';
import type { Primitive } from './directives/primitive.js';
import {
  type ContextualKey,
  type EffectHook,
  type FinalizerHook,
  type Hook,
  HookType,
  type IdentifierHook,
  type InitialState,
  type MemoHook,
  type NewState,
  type ReducerHook,
  type RefObject,
  type UpdateOptions,
  type UserHook,
  ensureHookType,
  userHookTag,
} from './hook.js';
import type { Part } from './part.js';
import type { RenderHost } from './renderHost.js';
import { TemplateLiteralPreprocessor } from './templateLiteral.js';

interface RenderFrame {
  pendingBindings: Binding<unknown>[];
  mutationEffects: Effect[];
  layoutEffects: Effect[];
  passiveEffects: Effect[];
}

interface ContextualScope {
  parent: ContextualScope | null;
  context: UpdateContext;
  registry: Map<WeakKey, unknown>;
}

interface GlobalState {
  cachedTemplates: WeakMap<readonly string[], Template<readonly unknown[]>>;
  dirtyBindings: Set<Binding<unknown>>;
  identifierCount: number;
  templatePlaceholder: string;
  templateLiteralPreprocessor: TemplateLiteralPreprocessor;
}

type UseUserHooks<TArray> = TArray extends [
  UserHook<infer THead>,
  ...infer TTail,
]
  ? [THead, ...UseUserHooks<TTail>]
  : [];

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

  get templateLiteralPreprocessor(): TemplateLiteralPreprocessor {
    return this._globalState.templateLiteralPreprocessor;
  }

  createIdentifier(count: number): string {
    return ':' + this._globalState.templatePlaceholder + '-' + count + ':';
  }

  enqueueBinding(binding: Binding<unknown>): void {
    this._renderFrame.pendingBindings.push(binding);
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

  async flushFrame(options?: UpdateOptions): Promise<void> {
    const { dirtyBindings } = this._globalState;

    while (true) {
      const pendingBindings = consumePendingBindings(this._renderFrame);
      for (let i = 0, l = pendingBindings.length; i < l; i++) {
        const pendingBinding = pendingBindings[i]!;
        pendingBinding.connect(this);
        dirtyBindings.delete(pendingBinding);
      }
      if (this._renderFrame.pendingBindings.length === 0) {
        break;
      }
      await this._renderHost.yieldToMain();
    }

    const { mutationEffects, layoutEffects, passiveEffects } = consumeEffects(
      this._renderFrame,
    );
    const callback = () => {
      commitEffects(mutationEffects);
      commitEffects(layoutEffects);
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
          commitEffects(passiveEffects);
        },
        { priority: 'background' },
      );
    }
  }

  getContextualValue<T>(key: ContextualKey<T>): T {
    let contextualScope = this._contextualScope;
    while (contextualScope !== null) {
      const value = contextualScope.registry.get(key);
      if (value !== undefined) {
        return value as T;
      }
      contextualScope = contextualScope.parent;
    }
    return key.defaultValue;
  }

  getTemplate(
    strings: readonly string[],
    binds: readonly unknown[],
    mode: TemplateMode,
  ): Template<readonly unknown[]> {
    let template = this._globalState.cachedTemplates.get(strings);

    if (template === undefined) {
      template = this._renderHost.createTemplate(
        strings,
        binds,
        this._globalState.templatePlaceholder,
        mode,
      );
      this._globalState.cachedTemplates.set(strings, template);
    }

    return template;
  }

  nextIdentifier(): number {
    return ++this._globalState.identifierCount;
  }

  reconcileBinding<T>(binding: Binding<T>, value: Bindable<T>): Binding<T> {
    const element = this.resolveDirectiveElement(value, binding.part);
    if (binding.directive === element.directive) {
      if (binding.bind(element.value, this)) {
        binding.connect(this);
      }
    } else {
      binding.disconnect(this);
      binding = element.directive.resolveBinding(
        element.value,
        binding.part,
        this,
      );
      binding.connect(this);
    }
    return binding;
  }

  renderComponent<TProps, TResult>(
    component: Component<TProps, TResult>,
    props: TProps,
    hooks: Hook[],
    binding: Binding<TProps>,
  ): TResult {
    const updateEngine = new UpdateEngine(
      this._renderHost,
      createRenderFrame(),
      this._contextualScope,
      this._globalState,
    );
    const renderEngine = new RenderEngine(hooks, binding, updateEngine);
    const element = component(props, renderEngine);
    renderEngine.finalize();
    return element;
  }

  renderTemplate<TBinds, TPart extends Part>(
    template: Template<TBinds, TPart>,
    binds: TBinds,
  ): TemplateBlock<TBinds, TPart> {
    return template.render(binds, this);
  }

  resolveBinding<T>(value: Bindable<T>, part: Part): Binding<T> {
    const element = this.resolveDirectiveElement(value, part);
    return element.directive.resolveBinding(element.value, part, this);
  }

  resolveDirectiveElement<T>(
    value: Bindable<T>,
    part: Part,
  ): DirectiveElement<T> {
    if (isDirectiveElement(value)) {
      return value;
    } else if (isDirectiveObject(value)) {
      return createDirectiveElement(value.directive, value as T);
    } else {
      type EnsureValue = (value: unknown, part: Part) => void;
      const directive = this._renderHost.resolvePrimitive(part) as Primitive<T>;
      (directive.ensureValue as EnsureValue)(value, part);
      return createDirectiveElement(directive, value);
    }
  }

  setContextualValue(key: WeakKey, value: unknown): void {
    if (this._contextualScope?.context !== this) {
      this._contextualScope ??= {
        parent: this._contextualScope,
        context: this,
        registry: new Map(),
      };
    }
    this._contextualScope.registry.set(key, value);
  }

  scheduleUpdate(
    binding: Binding<unknown>,
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
        this._renderFrame.pendingBindings.push(binding);
        this._renderFrame.mutationEffects.push(binding);
        await this.flushFrame(options);
      },
      { priority: options?.priority ?? this._renderHost.getTaskPriority() },
    );
  }
}

export class RenderEngine implements RenderContext {
  private readonly _hooks: Hook[];

  private readonly _binding: Binding<unknown>;

  private readonly _updateEngine: UpdateEngine;

  private _pendingUpdateOptions: UpdateOptions | null = null;

  private _hookIndex = 0;

  constructor(
    hooks: Hook[],
    binding: Binding<unknown>,
    updateEngine: UpdateEngine,
  ) {
    this._binding = binding;
    this._hooks = hooks;
    this._updateEngine = updateEngine;
  }

  dynamicHTML(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): DirectiveElement<readonly unknown[]> {
    return this._dynamicTemplate(strings, binds, 'html');
  }

  dynamicMath(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): DirectiveElement<readonly unknown[]> {
    return this._dynamicTemplate(strings, binds, 'math');
  }

  dynamicSVG(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): DirectiveElement<readonly unknown[]> {
    return this._dynamicTemplate(strings, binds, 'svg');
  }

  getContextualValue<T>(key: ContextualKey<T>): T {
    return this._updateEngine.getContextualValue(key);
  }

  finalize(): void {
    const currentHook = this._hooks[this._hookIndex++];

    if (currentHook !== undefined) {
      ensureHookType<FinalizerHook>(HookType.Finalizer, currentHook);
    } else {
      this._hooks.push({ type: HookType.Finalizer });

      // Refuse to use new hooks after finalization.
      Object.freeze(this._hooks);
    }
  }

  forceUpdate(options: UpdateOptions = {}): void {
    if (this._pendingUpdateOptions === null) {
      queueMicrotask(() => {
        this._updateEngine.scheduleUpdate(
          this._binding,
          this._pendingUpdateOptions!,
        );
        this._pendingUpdateOptions = null;
      });
    }
    this._pendingUpdateOptions = options;
  }

  html(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): DirectiveElement<readonly unknown[]> {
    return this._template(strings, binds, 'html');
  }

  math(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): DirectiveElement<readonly unknown[]> {
    return this._template(strings, binds, 'math');
  }

  setContextualValue<T>(key: ContextualKey<T>, value: T): void {
    return this._updateEngine.setContextualValue(key, value);
  }

  svg(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): DirectiveElement<readonly unknown[]> {
    return this._template(strings, binds, 'svg');
  }

  use<T>(hook: UserHook<T>): T;
  use<T extends UserHook<any>[]>(hooks: T): UseUserHooks<T>;
  use<T>(hook: UserHook<T> | UserHook<T>[]): T | T[] {
    if (Array.isArray(hook)) {
      return hook.map((hook) => hook[userHookTag](this));
    } else {
      return hook[userHookTag](this);
    }
  }

  useCallback<TCallback extends Function>(
    callback: TCallback,
    dependencies: unknown[],
  ): TCallback {
    return this.useMemo(() => callback, dependencies);
  }

  useDeferredValue<TValue>(
    value: TValue,
    initialValue?: InitialState<TValue>,
  ): TValue {
    const [deferredValue, setDeferredValue] = this.useReducer<TValue, TValue>(
      (_state, action) => action,
      initialValue ?? (() => value),
    );

    this.useEffect(() => {
      setDeferredValue(value, { priority: 'background' });
    }, [value]);

    return deferredValue;
  }

  useEffect(
    callback: () => VoidFunction | void,
    dependencies: unknown[] | null = null,
    type: EffectHook['type'] = HookType.PassiveEffect,
  ): void {
    const currentHook = this._hooks[this._hookIndex++];

    if (currentHook !== undefined) {
      ensureHookType<EffectHook>(type, currentHook);
      if (dependenciesAreChanged(currentHook.dependencies, dependencies)) {
        this._updateEngine.enqueuePassiveEffect(
          new InvokeEffectHook(currentHook),
        );
      }
      currentHook.callback = callback;
      currentHook.dependencies = dependencies;
    } else {
      const hook: EffectHook = {
        type,
        callback,
        dependencies,
        cleanup: undefined,
      };
      this._hooks.push(hook);
      this._updateEngine.enqueuePassiveEffect(new InvokeEffectHook(hook));
    }
  }

  useId(): string {
    let currentHook = this._hooks[this._hookIndex++];

    if (currentHook !== undefined) {
      ensureHookType<IdentifierHook>(HookType.Identifier, currentHook);
    } else {
      currentHook = {
        type: HookType.Identifier,
        id: this._updateEngine.nextIdentifier(),
      };
      this._hooks.push(currentHook);
    }

    return this._updateEngine.createIdentifier(currentHook.id);
  }

  useInsertionEffect(
    callback: () => VoidFunction | void,
    dependencies: unknown[] | null = null,
  ): void {
    return this.useEffect(callback, dependencies, HookType.InsertionEffect);
  }

  useLayoutEffect(
    callback: () => VoidFunction | void,
    dependencies: unknown[] | null = null,
  ): void {
    return this.useEffect(callback, dependencies, HookType.LayoutEffect);
  }

  useMemo<TResult>(factory: () => TResult, dependencies: unknown[]): TResult {
    let currentHook = this._hooks[this._hookIndex++];

    if (currentHook !== undefined) {
      ensureHookType<MemoHook<TResult>>(HookType.Memo, currentHook);

      if (dependenciesAreChanged(currentHook.dependencies, dependencies)) {
        currentHook.value = factory();
        currentHook.dependencies = dependencies;
      }
    } else {
      currentHook = {
        type: HookType.Memo,
        value: factory(),
        dependencies,
      };
      this._hooks.push(currentHook);
    }

    return currentHook.value as TResult;
  }

  useReducer<TState, TAction>(
    reducer: (state: TState, action: TAction) => TState,
    initialState: InitialState<TState>,
  ): [TState, (action: TAction, options?: UpdateOptions) => void] {
    let currentHook = this._hooks[this._hookIndex++];

    if (currentHook !== undefined) {
      ensureHookType<ReducerHook<TState, TAction>>(
        HookType.Reducer,
        currentHook,
      );
    } else {
      const hook: ReducerHook<TState, TAction> = {
        type: HookType.Reducer,
        state:
          typeof initialState === 'function' ? initialState() : initialState,
        dispatch: (action: TAction, options?: UpdateOptions) => {
          const oldState = hook.state;
          const newState = reducer(oldState, action);
          if (!Object.is(oldState, newState)) {
            hook.state = newState;
            this.forceUpdate(options);
          }
        },
      };
      currentHook = hook;
      this._hooks.push(hook);
    }

    return [currentHook.state as TState, currentHook.dispatch];
  }

  useRef<T>(initialValue: T): RefObject<T> {
    return this.useMemo(() => Object.seal({ current: initialValue }), []);
  }

  useState<TState>(
    initialState: InitialState<TState>,
  ): [TState, (newState: NewState<TState>, options?: UpdateOptions) => void] {
    return this.useReducer(
      (state, action) =>
        typeof action === 'function' ? action(state) : action,
      initialState,
    );
  }

  useSyncEnternalStore<T>(
    subscribe: (subscruber: () => void) => VoidFunction | void,
    getSnapshot: () => T,
    options?: UpdateOptions,
  ): T {
    this.useEffect(
      () =>
        subscribe(() => {
          this.forceUpdate(options);
        }),
      [subscribe],
    );
    return getSnapshot();
  }

  private _dynamicTemplate(
    strings: TemplateStringsArray,
    binds: readonly unknown[],
    mode: TemplateMode,
  ): DirectiveElement<readonly unknown[]> {
    const { strings: expandedStrings, values: expandedBinds } =
      this._updateEngine.templateLiteralPreprocessor.expandLiterals(
        strings,
        binds,
      );
    const template = this._updateEngine.getTemplate(
      expandedStrings,
      expandedBinds,
      mode,
    );
    return createDirectiveElement(template, binds);
  }

  private _template(
    strings: TemplateStringsArray,
    binds: readonly unknown[],
    mode: TemplateMode,
  ): DirectiveElement<readonly unknown[]> {
    const template = this._updateEngine.getTemplate(strings, binds, mode);
    return createDirectiveElement(template, binds);
  }
}

class InvokeEffectHook implements Effect {
  private readonly _hook: EffectHook;

  constructor(hook: EffectHook) {
    this._hook = hook;
  }

  commit(): void {
    const { cleanup, callback } = this._hook;
    cleanup?.();
    this._hook.cleanup = callback();
  }
}

function commitEffects(effects: Effect[]): void {
  for (let i = 0, l = effects.length; i < l; i++) {
    effects[i]!.commit();
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

function consumePendingBindings(renderFrame: RenderFrame): Binding<unknown>[] {
  const { pendingBindings } = renderFrame;
  renderFrame.pendingBindings = [];
  return pendingBindings;
}

function createGlobalState(): GlobalState {
  return {
    cachedTemplates: new WeakMap(),
    dirtyBindings: new Set(),
    identifierCount: 0,
    templateLiteralPreprocessor: new TemplateLiteralPreprocessor(),
    templatePlaceholder: getRandomString(8),
  };
}

function createRenderFrame(): RenderFrame {
  return {
    pendingBindings: [],
    mutationEffects: [],
    layoutEffects: [],
    passiveEffects: [],
  };
}

function getRandomString(length: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), (byte) =>
    (byte % 36).toString(36),
  ).join('');
}
