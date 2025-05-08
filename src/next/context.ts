import { dependenciesAreChanged } from './compare.js';
import {
  type Binding,
  type ComponentFunction,
  type DirectiveElement,
  type DirectiveValue,
  type Effect,
  EffectPhase,
  type EffectProtocol,
  type RenderProtocol,
  type Template,
  type TemplateInstance,
  type TemplateMode,
  type UpdateProtocol,
  isDirectiveElement,
  resolveBindingTag,
} from './coreTypes.js';
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
import type { Primitive } from './primitives/primitive.js';
import type { RenderHost } from './renderHost.js';

interface RenderFrame {
  pendingBindings: Binding<unknown>[];
  mutationEffects: Effect[];
  layoutEffects: Effect[];
  passiveEffects: Effect[];
}

interface ContextualScope {
  parent: ContextualScope | null;
  key: ContextualKey<unknown>;
  value: unknown;
}

interface GlobalState {
  cachedTemplates: WeakMap<readonly string[], Template<unknown>>;
  dirtyBindings: WeakSet<Binding<unknown>>;
  identifierCount: number;
}

type UseUserHooks<TArray> = TArray extends [
  UserHook<infer THead>,
  ...infer TTail,
]
  ? [THead, ...UseUserHooks<TTail>]
  : [];

export class UpdateContext implements UpdateProtocol {
  private readonly _renderHost: RenderHost;

  private readonly _renderFrame: RenderFrame;

  private readonly _contextualScope: ContextualScope | null;

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

  createIdentifier(count: number): string {
    return ':' + this._renderHost.getHostName() + '-' + count + ':';
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

  enterContextualScope<T>(key: ContextualKey<T>, value: T): UpdateContext {
    const contextualScope = {
      parent: this._contextualScope,
      key,
      value,
    };
    return new UpdateContext(
      this._renderHost,
      this._renderFrame,
      contextualScope,
      this._globalState,
    );
  }

  async flushUpdate(
    binding: Binding<unknown>,
    options?: UpdateOptions,
  ): Promise<void> {
    const { dirtyBindings } = this._globalState;
    let pendingBindings = [binding];

    while (true) {
      for (let i = 0, l = pendingBindings.length; i < l; i++) {
        const pendingBinding = pendingBindings[i]!;
        pendingBinding.connect(this);
        dirtyBindings.delete(binding);
      }
      if (this._renderFrame.pendingBindings.length === 0) {
        break;
      }
      pendingBindings = consumePendingBindings(this._renderFrame);
      await this._renderHost.yieldToMain();
    }

    const { mutationEffects, layoutEffects, passiveEffects } = consumeEffects(
      this._renderFrame,
    );
    const callback = () => {
      binding.commit({ phase: EffectPhase.Mutation });
      this._commitEffects(mutationEffects, {
        phase: EffectPhase.Mutation,
      });
      this._commitEffects(layoutEffects, { phase: EffectPhase.Layout });
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
          this._commitEffects(passiveEffects, {
            phase: EffectPhase.Passive,
          });
        },
        { priority: 'background' },
      );
    }
  }

  getContextualValue<T>(key: ContextualKey<T>): T | undefined {
    let contextualScope = this._contextualScope;
    while (contextualScope !== null) {
      if (contextualScope.key === key) {
        return contextualScope.value as T;
      }
      contextualScope = contextualScope.parent;
    }
    return key.defaultValue;
  }

  getTemplate<TBinds extends readonly any[]>(
    strings: readonly string[],
    binds: TBinds,
    mode: TemplateMode,
  ): Template<TBinds> {
    let template = this._globalState.cachedTemplates.get(strings);

    if (template === undefined) {
      template = this._renderHost.createTemplate(strings, binds, mode);
      this._globalState.cachedTemplates.set(strings, template);
    }

    return template as Template<TBinds>;
  }

  nextIdentifier(): number {
    return ++this._globalState.identifierCount;
  }

  prepareBinding<T>(value: DirectiveValue<T>, part: Part): Binding<T> {
    const element = isDirectiveElement(value)
      ? value
      : this.resolvePrimitiveElement(value, part);
    const binding = element.directive[resolveBindingTag](
      element.value,
      part,
      this,
    );
    binding.connect(this);
    return binding;
  }

  reconcileBinding<T>(
    binding: Binding<T>,
    value: DirectiveValue<T>,
  ): Binding<T> {
    const element = isDirectiveElement(value)
      ? value
      : this.resolvePrimitiveElement(value, binding.part);
    if (binding.directive === element.directive) {
      binding.bind(element.value, this);
    } else {
      binding.unbind(this);
      binding = element.directive[resolveBindingTag](
        element.value,
        binding.part,
        this,
      );
      binding.connect(this);
    }
    return binding;
  }

  renderComponent<TProps>(
    component: ComponentFunction<TProps>,
    props: TProps,
    hooks: Hook[],
    binding: Binding<TProps>,
  ): unknown {
    const updateContext = new UpdateContext(
      this._renderHost,
      createRenderFrame(),
      this._contextualScope,
      this._globalState,
    );
    const renderContext = new RenderContext(hooks, binding, updateContext);
    const element = component(props, renderContext);
    renderContext.finalize();
    return element;
  }

  renderTemplate<TBinds>(
    template: Template<TBinds>,
    binds: TBinds,
  ): TemplateInstance<TBinds> {
    return template.render(binds, this);
  }

  resolvePrimitiveElement<T>(value: T, part: Part): DirectiveElement<T> {
    type EnsureValue = (value: unknown, part: Part) => void;
    const directive = this._renderHost.resolvePrimitive(part) as Primitive<T>;
    (directive.ensureValue as EnsureValue)(value, part);
    return {
      directive,
      value,
    };
  }

  scheduleUpdate(
    binding: Binding<unknown>,
    options?: UpdateOptions,
  ): Promise<void> {
    this._globalState.dirtyBindings.add(binding);

    return this._renderHost.requestCallback(
      () => {
        if (!this._globalState.dirtyBindings.has(binding)) {
          return Promise.resolve();
        }
        return this.flushUpdate(binding, options);
      },
      { priority: options?.priority ?? this._renderHost.getTaskPriority() },
    );
  }

  private _commitEffects(effects: Effect[], context: EffectProtocol): void {
    for (let i = 0, l = effects.length; i < l; i++) {
      effects[i]!.commit(context);
    }
  }
}

export class RenderContext implements RenderProtocol {
  private readonly _hooks: Hook[];

  private readonly _binding: Binding<unknown>;

  private readonly _updateContext: UpdateContext;

  private _pendingUpdateOptions: UpdateOptions | null = null;

  private _hookIndex = 0;

  constructor(
    hooks: Hook[],
    binding: Binding<unknown>,
    updateContext: UpdateContext,
  ) {
    this._binding = binding;
    this._hooks = hooks;
    this._updateContext = updateContext;
  }

  /** @internal */
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
        this._updateContext.scheduleUpdate(
          this._binding,
          this._pendingUpdateOptions!,
        );
        this._pendingUpdateOptions = null;
      });
    }
    this._pendingUpdateOptions = options;
  }

  html<TBinds extends readonly any[]>(
    strings: TemplateStringsArray,
    ...binds: TBinds
  ): DirectiveElement<TBinds> {
    return {
      directive: this._updateContext.getTemplate(strings, binds, 'html'),
      value: binds,
    };
  }

  math<TBinds extends readonly any[]>(
    strings: TemplateStringsArray,
    ...binds: TBinds
  ): DirectiveElement<TBinds> {
    return {
      directive: this._updateContext.getTemplate(strings, binds, 'math'),
      value: binds,
    };
  }

  svg<TBinds extends readonly any[]>(
    strings: TemplateStringsArray,
    ...binds: TBinds
  ): DirectiveElement<TBinds> {
    return {
      directive: this._updateContext.getTemplate(strings, binds, 'svg'),
      value: binds,
    };
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

  useContext<T>(context: ContextualKey<T>): T | undefined {
    return this._updateContext.getContextualValue(context);
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
  ): void {
    const currentHook = this._hooks[this._hookIndex++];

    if (currentHook !== undefined) {
      ensureHookType<EffectHook>(HookType.PassiveEffect, currentHook);
      if (dependenciesAreChanged(currentHook.dependencies, dependencies)) {
        this._updateContext.enqueuePassiveEffect(
          new InvokeEffectHook(currentHook),
        );
      }
      currentHook.callback = callback;
      currentHook.dependencies = dependencies;
    } else {
      const hook: EffectHook = {
        type: HookType.PassiveEffect,
        callback,
        dependencies,
        cleanup: undefined,
      };
      this._hooks.push(hook);
      this._updateContext.enqueuePassiveEffect(new InvokeEffectHook(hook));
    }
  }

  useId(): string {
    let currentHook = this._hooks[this._hookIndex++];

    if (currentHook !== undefined) {
      ensureHookType<IdentifierHook>(HookType.Identifier, currentHook);
    } else {
      currentHook = {
        type: HookType.Identifier,
        id: this._updateContext.nextIdentifier(),
      };
      this._hooks.push(currentHook);
    }

    return this._updateContext.createIdentifier(currentHook.id);
  }

  useInsertionEffect(
    callback: () => VoidFunction | void,
    dependencies: unknown[] | null = null,
  ): void {
    const currentHook = this._hooks[this._hookIndex++];

    if (currentHook !== undefined) {
      ensureHookType<EffectHook>(HookType.InsertionEffect, currentHook);
      if (dependenciesAreChanged(currentHook.dependencies, dependencies)) {
        this._updateContext.enqueueMutationEffect(
          new InvokeEffectHook(currentHook),
        );
      }
      currentHook.callback = callback;
      currentHook.dependencies = dependencies;
    } else {
      const hook: EffectHook = {
        type: HookType.InsertionEffect,
        callback,
        dependencies,
        cleanup: undefined,
      };
      this._hooks.push(hook);
      this._updateContext.enqueueMutationEffect(new InvokeEffectHook(hook));
    }
  }

  useLayoutEffect(
    callback: () => VoidFunction | void,
    dependencies: unknown[] | null = null,
  ): void {
    const currentHook = this._hooks[this._hookIndex++];

    if (currentHook !== undefined) {
      ensureHookType<EffectHook>(HookType.LayoutEffect, currentHook);
      if (dependenciesAreChanged(currentHook.dependencies, dependencies)) {
        this._updateContext.enqueueLayoutEffect(
          new InvokeEffectHook(currentHook),
        );
      }
      currentHook.callback = callback;
      currentHook.dependencies = dependencies;
    } else {
      const hook: EffectHook = {
        type: HookType.LayoutEffect,
        callback,
        dependencies,
        cleanup: undefined,
      };
      this._hooks.push(hook);
      this._updateContext.enqueueLayoutEffect(new InvokeEffectHook(hook));
    }
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

    return currentHook.value;
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

    return [currentHook.state, currentHook.dispatch];
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
    dirtyBindings: new WeakSet(),
    identifierCount: 0,
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
