import { dependenciesAreChanged } from './compare.js';
import { TemplateResult } from './directives/templateResult.js';
import {
  type ElementData,
  ElementTemplate,
} from './template/elementTemplate.js';
import { EmptyTemplate } from './template/emptyTemplate.js';
import { ChildNodeTemplate, TextTemplate } from './template/singleTemplate.js';
import { TaggedTemplate, getMarker } from './template/taggedTemplate.js';
import {
  type Block,
  type Cleanup,
  type ComponentFunction,
  type Effect,
  type EffectCallback,
  type EffectHook,
  type EffectPhase,
  type FinalizerHook,
  type Hook,
  HookType,
  type MemoHook,
  type ReducerHook,
  type RefObject,
  type TaskPriority,
  type TemplateDirective,
  type UpdateHost,
  type Updater,
} from './types.js';

export const usableTag = Symbol('Usable');

export type Usable<TResult, TContext> =
  | UsableCallback<TResult, TContext>
  | UsableObject<TResult, TContext>;

export type UsableCallback<TResult, TContext> = (context: TContext) => TResult;

export type InitialState<TState> = TState extends Function
  ? () => TState
  : (() => TState) | TState;

export type NewState<TState> = TState extends Function
  ? (prevState: TState) => TState
  : ((prevState: TState) => TState) | TState;

export interface UsableObject<TResult, TContext> {
  [usableTag](context: TContext): TResult;
}

export interface RenderHostOptions {
  constants?: Map<unknown, unknown>;
}

export class RenderHost implements UpdateHost<RenderContext> {
  private readonly _constants: Map<unknown, unknown>;

  private readonly _blockScopes: WeakMap<
    Block<RenderContext>,
    Map<unknown, unknown>
  > = new WeakMap();

  private readonly _cachedTemplates: WeakMap<
    ReadonlyArray<string>,
    TaggedTemplate<readonly any[]>
  > = new WeakMap();

  private readonly _marker: string = getMarker();

  constructor({ constants = new Map() }: RenderHostOptions = {}) {
    this._constants = new Map(constants);
  }

  flushEffects(effects: Effect[], phase: EffectPhase): void {
    for (let i = 0, l = effects.length; i < l; i++) {
      effects[i]!.commit(phase);
    }
  }

  getHTMLTemplate<TData extends readonly any[]>(
    tokens: ReadonlyArray<string>,
    data: TData,
  ): TaggedTemplate<TData> {
    let template = this._cachedTemplates.get(tokens);

    if (template === undefined) {
      template = TaggedTemplate.parseHTML(tokens, data, this._marker);
      this._cachedTemplates.set(tokens, template);
    }

    return template;
  }

  getSVGTemplate<TData extends readonly any[]>(
    tokens: ReadonlyArray<string>,
    data: TData,
  ): TaggedTemplate<TData> {
    let template = this._cachedTemplates.get(tokens);

    if (template === undefined) {
      template = TaggedTemplate.parseSVG(tokens, data, this._marker);
      this._cachedTemplates.set(tokens, template);
    }

    return template;
  }

  getScopedValue(
    key: unknown,
    block: Block<RenderContext> | null = null,
  ): unknown {
    let currentScope = block;
    while (currentScope !== null) {
      const value = this._blockScopes.get(currentScope)?.get(key);
      if (value !== undefined) {
        return value;
      }
      currentScope = currentScope.parent;
    }
    return this._constants.get(key);
  }

  renderComponent<TProps, TData>(
    component: ComponentFunction<TProps, TData, RenderContext>,
    props: TProps,
    hooks: Hook[],
    block: Block<RenderContext>,
    updater: Updater<RenderContext>,
  ): TemplateDirective<TData, RenderContext> {
    const context = new RenderContext(hooks, block, this, updater);
    const result = component(props, context);
    context.finalize();
    return result;
  }

  setScopedValue(
    key: unknown,
    value: unknown,
    block: Block<RenderContext>,
  ): void {
    const variables = this._blockScopes.get(block);
    if (variables !== undefined) {
      variables.set(key, value);
    } else {
      const namespace = new Map();
      namespace.set(key, value);
      this._blockScopes.set(block, namespace);
    }
  }
}

export class RenderContext {
  private readonly _hooks: Hook[];

  private readonly _block: Block<RenderContext>;

  private readonly _host: RenderHost;

  private readonly _updater: Updater<RenderContext>;

  private _hookIndex = 0;

  constructor(
    hooks: Hook[],
    block: Block<RenderContext>,
    host: RenderHost,
    updater: Updater<RenderContext>,
  ) {
    this._hooks = hooks;
    this._block = block;
    this._host = host;
    this._updater = updater;
  }

  childNode<T>(value: T): TemplateDirective<T, RenderContext> {
    const template = ChildNodeTemplate.instance;
    return new TemplateResult(template, value);
  }

  element<TElementValue, TChildNodeValue>(
    type: string,
    elementValue: TElementValue,
    childNodeValue: TChildNodeValue,
  ): TemplateDirective<
    ElementData<TElementValue, TChildNodeValue>,
    RenderContext
  > {
    const template = new ElementTemplate<TElementValue, TChildNodeValue>(type);
    return new TemplateResult(template, { elementValue, childNodeValue });
  }

  empty(): TemplateDirective<null, RenderContext> {
    const template = EmptyTemplate.instance;
    return new TemplateResult(template, null);
  }

  /**
   * @internal
   */
  finalize(): void {
    const currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<FinalizerHook>(HookType.Finalizer, currentHook);
    } else {
      this._hooks.push({ type: HookType.Finalizer });
    }
  }

  getContextValue(key: unknown): unknown {
    return this._host.getScopedValue(key, this._block);
  }

  html<TData extends readonly any[]>(
    tokens: ReadonlyArray<string>,
    ...data: TData
  ): TemplateDirective<TData, RenderContext> {
    const template = this._host.getHTMLTemplate(tokens, data);
    return new TemplateResult(template, data);
  }

  isFirstRender(): boolean {
    return (
      this._hooks.length === 0 ||
      this._hooks[this._hooks.length - 1]!.type !== HookType.Finalizer
    );
  }

  requestUpdate(): void {
    this._block.requestUpdate(
      this._updater.getCurrentPriority(),
      this._updater,
    );
  }

  setContextValue(key: unknown, value: unknown): void {
    this._host.setScopedValue(key, value, this._block);
  }

  svg<TData extends readonly any[]>(
    tokens: ReadonlyArray<string>,
    ...data: TData
  ): TemplateDirective<TData, RenderContext> {
    const template = this._host.getSVGTemplate(tokens, data);
    return new TemplateResult(template, data);
  }

  text<T>(value: T): TemplateDirective<T, RenderContext> {
    const template = TextTemplate.instance;
    return new TemplateResult(template, value);
  }

  use<TResult>(usable: Usable<TResult, RenderContext>): TResult {
    return usableTag in usable ? usable[usableTag](this) : usable(this);
  }

  useCallback<TCallback extends Function>(
    callback: TCallback,
    dependencies: unknown[],
  ): TCallback {
    return this.useMemo(() => callback, dependencies);
  }

  useDeferredValue<TValue>(value: TValue, initialValue?: TValue): TValue {
    const [deferredValue, setDeferredValue] = this.useState<TValue>(
      (() => initialValue ?? value) as InitialState<TValue>,
    );

    this.useEffect(() => {
      setDeferredValue((() => value) as NewState<TValue>, 'background');
    }, [value]);

    return deferredValue;
  }

  useEffect(callback: EffectCallback, dependencies?: unknown[]): void {
    const currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<EffectHook>(HookType.Effect, currentHook);

      if (dependenciesAreChanged(currentHook.dependencies, dependencies)) {
        this._updater.enqueuePassiveEffect(
          new InvokeEffectHook(currentHook, callback),
        );
      }

      currentHook.dependencies = dependencies;
    } else {
      const hook: EffectHook = {
        type: HookType.Effect,
        dependencies,
        cleanup: undefined,
      };
      this._hooks.push(hook);
      this._updater.enqueuePassiveEffect(new InvokeEffectHook(hook, callback));
    }

    this._hookIndex++;
  }

  useEvent<THandler extends (...args: any[]) => any>(
    handler: THandler,
  ): (...args: Parameters<THandler>) => ReturnType<THandler> {
    const handlerRef = this.useRef<THandler | null>(null);

    this.useLayoutEffect(() => {
      handlerRef.current = handler;
    }, [handler]);

    return this.useCallback(function (
      this: ThisType<THandler>,
      ...args: Parameters<THandler>
    ) {
      const currentHandler = handlerRef.current!;
      return currentHandler.call(this, args);
    }, []);
  }

  useLayoutEffect(callback: EffectCallback, dependencies?: unknown[]): void {
    const currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<EffectHook>(HookType.Effect, currentHook);

      if (dependenciesAreChanged(currentHook.dependencies, dependencies)) {
        this._updater.enqueueLayoutEffect(
          new InvokeEffectHook(currentHook, callback),
        );
      }

      currentHook.dependencies = dependencies;
    } else {
      const hook: EffectHook = {
        type: HookType.Effect,
        dependencies,
        cleanup: undefined,
      };
      this._hooks.push(hook);
      this._updater.enqueueLayoutEffect(new InvokeEffectHook(hook, callback));
    }

    this._hookIndex++;
  }

  useMemo<TResult>(factory: () => TResult, dependencies: unknown[]): TResult {
    let currentHook = this._hooks[this._hookIndex];

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

    this._hookIndex++;

    return currentHook.value;
  }

  useReducer<TState, TAction>(
    reducer: (state: TState, action: TAction) => TState,
    initialState: InitialState<TState>,
  ): [TState, (action: TAction, priority?: TaskPriority) => void] {
    let currentHook = this._hooks[this._hookIndex];

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
        dispatch: (action: TAction, priority?: TaskPriority) => {
          const nextState = reducer(hook.state, action);
          if (!Object.is(hook.state, nextState)) {
            hook.state = nextState;
            this._block.requestUpdate(
              priority ?? this._updater.getCurrentPriority(),
              this._updater,
            );
          }
        },
      };
      currentHook = hook;
      this._hooks.push(hook);
    }

    this._hookIndex++;

    return [currentHook.state, currentHook.dispatch];
  }

  useRef<T>(initialValue: T): RefObject<T> {
    return this.useMemo(() => ({ current: initialValue }), []);
  }

  useState<TState>(
    initialState: InitialState<TState>,
  ): [TState, (newState: NewState<TState>, priority?: TaskPriority) => void] {
    return this.useReducer(
      (state, action) =>
        typeof action === 'function' ? action(state) : action,
      initialState,
    );
  }

  useSyncEnternalStore<T>(
    subscribe: (subscruber: () => void) => Cleanup | void,
    getSnapshot: () => T,
    priority?: TaskPriority,
  ): T {
    this.useEffect(
      () =>
        subscribe(() => {
          this._block.requestUpdate(
            priority ?? this._updater.getCurrentPriority(),
            this._updater,
          );
        }),
      [subscribe, priority],
    );
    return getSnapshot();
  }
}

class InvokeEffectHook implements Effect {
  private readonly _hook: EffectHook;

  private readonly _callback: () => void;

  constructor(hook: EffectHook, callback: () => void) {
    this._hook = hook;
    this._callback = callback;
  }

  commit(): void {
    const callback = this._callback;
    this._hook.cleanup?.();
    this._hook.cleanup = callback();
  }
}

function ensureHookType<TExpectedHook extends Hook>(
  expectedType: TExpectedHook['type'],
  hook: Hook,
): asserts hook is TExpectedHook {
  if (hook.type !== expectedType) {
    throw new Error(
      `Unexpected hook type. Expected "${expectedType}" but got "${hook.type}".`,
    );
  }
}
