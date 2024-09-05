import {
  type Block,
  type Cleanup,
  type Effect,
  type EffectCallback,
  type EffectHook,
  type FilterLiterals,
  type FinalizerHook,
  type Hook,
  HookType,
  type IdentifierHook,
  type MemoHook,
  type ReducerHook,
  type RefObject,
  type RenderHost,
  type TaskPriority,
  type TemplateResult,
  UpdateContext,
  type UpdateQueue,
  type Updater,
  createUpdateQueue,
} from './baseTypes.js';
import { dependenciesAreChanged } from './compare.js';

export const usableTag = Symbol('Usable');

export type Usable<TResult, TContext> =
  | UsableObject<TResult, TContext>
  | UsableCallback<TResult, TContext>;

export interface UsableObject<TResult, TContext> {
  [usableTag](context: TContext): TResult;
}

export type UsableCallback<TResult, TContext> = (context: TContext) => TResult;

export type Use<TUsable, TContext> = TUsable extends Usable<
  infer TResult,
  TContext
>
  ? TResult
  : TUsable extends []
    ? []
    : TUsable extends [Usable<infer THead, TContext>, ...infer TTail]
      ? [THead, ...Use<TTail, TContext>]
      : never;

export type InitialState<TState> = [TState] extends [Function]
  ? () => TState
  : (() => TState) | TState;

export type NewState<TState> = [TState] extends [Function]
  ? (prevState: TState) => TState
  : ((prevState: TState) => TState) | TState;

export class RenderContext {
  private readonly _host: RenderHost<RenderContext>;

  private readonly _updater: Updater<RenderContext>;

  private readonly _block: Block<RenderContext>;

  private readonly _queue: UpdateQueue<RenderContext>;

  private readonly _hooks: Hook[];

  private _hookIndex = 0;

  constructor(
    host: RenderHost<RenderContext>,
    updater: Updater<RenderContext>,
    block: Block<RenderContext>,
    queue: UpdateQueue<RenderContext> = createUpdateQueue(),
    hooks: Hook[] = [],
  ) {
    this._host = host;
    this._updater = updater;
    this._block = block;
    this._queue = queue;
    this._hooks = hooks;
  }

  get host(): RenderHost<RenderContext> {
    return this._host;
  }

  get updater(): Updater<RenderContext> {
    return this._updater;
  }

  get block(): Block<RenderContext> {
    return this._block;
  }

  /**
   * @internal
   */
  get queue(): UpdateQueue<RenderContext> {
    return this._queue;
  }

  /**
   * @internal
   */
  get hooks(): Hook[] {
    return this._hooks;
  }

  /**
   * @internal
   */
  clone(): RenderContext {
    return new RenderContext(
      this._host,
      this._updater,
      this._block,
      this._queue,
      this._hooks,
    );
  }

  dynamicHTML<TData extends readonly any[]>(
    strings: TemplateStringsArray,
    ...values: TData
  ): TemplateResult<FilterLiterals<TData>, RenderContext> {
    const { strings: staticStrings, values: staticValues } =
      this._host.processLiterals(strings, values);
    return this._host
      .getTemplate(staticStrings, staticValues, 'html')
      .wrapInResult(staticValues);
  }

  dynamicMath<TData extends readonly any[]>(
    strings: TemplateStringsArray,
    ...values: TData
  ): TemplateResult<FilterLiterals<TData>, RenderContext> {
    const { strings: staticStrings, values: staticValues } =
      this._host.processLiterals(strings, values);
    return this._host
      .getTemplate(staticStrings, staticValues, 'math')
      .wrapInResult(staticValues);
  }

  dynamicSVG<TData extends readonly any[]>(
    strings: TemplateStringsArray,
    ...values: TData
  ): TemplateResult<FilterLiterals<TData>, RenderContext> {
    const { strings: staticStrings, values: staticValues } =
      this._host.processLiterals(strings, values);
    return this._host
      .getTemplate(staticStrings, staticValues, 'svg')
      .wrapInResult(staticValues);
  }

  /**
   * @internal
   */
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

  /**
   * @internal
   */
  flushUpdate(): void {
    this._updater.flushUpdate(this._queue, this._host);
  }

  forceUpdate(priority?: TaskPriority): void {
    const context = new UpdateContext(
      this._host,
      this._updater,
      this._block,
      this._queue,
    );
    this._block.requestUpdate(
      priority ?? this._host.getCurrentPriority(),
      context,
    );
  }

  getContextValue(key: unknown): unknown {
    return this._host.getScopedValue(key, this._block);
  }

  html<TData extends readonly any[]>(
    strings: TemplateStringsArray,
    ...values: TData
  ): TemplateResult<TData, RenderContext> {
    return this._host.getTemplate(strings, values, 'html').wrapInResult(values);
  }

  isFirstRender(): boolean {
    return this._hooks.at(-1)?.type !== HookType.Finalizer;
  }

  isRendering(): boolean {
    return this._hooks[this._hookIndex - 1]?.type !== HookType.Finalizer;
  }

  math<TData extends readonly any[]>(
    strings: TemplateStringsArray,
    ...values: TData
  ): TemplateResult<TData, RenderContext> {
    return this._host.getTemplate(strings, values, 'math').wrapInResult(values);
  }

  setContextValue(key: unknown, value: unknown): void {
    this._host.setScopedValue(key, value, this._block);
  }

  svg<TData extends readonly any[]>(
    strings: TemplateStringsArray,
    ...values: TData
  ): TemplateResult<TData, RenderContext> {
    return this._host.getTemplate(strings, values, 'svg').wrapInResult(values);
  }

  unsafeHTML(content: string): TemplateResult<readonly [], RenderContext> {
    return this._host.getUnsafeTemplate(content, 'html').wrapInResult([]);
  }

  unsafeMath(content: string): TemplateResult<readonly [], RenderContext> {
    return this._host.getUnsafeTemplate(content, 'math').wrapInResult([]);
  }

  unsafeSVG(content: string): TemplateResult<readonly [], RenderContext> {
    return this._host.getUnsafeTemplate(content, 'svg').wrapInResult([]);
  }

  use<
    const TUsable extends
      | Usable<any, RenderContext>
      | Usable<any, RenderContext>[],
  >(usable: TUsable): Use<TUsable, RenderContext> {
    if (Array.isArray(usable)) {
      return usable.map((usable) => use(usable, this)) as Use<
        TUsable,
        RenderContext
      >;
    } else {
      return use(usable, this);
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
      setDeferredValue(value, 'background');
    }, [value]);

    return deferredValue;
  }

  useEffect(callback: EffectCallback, dependencies?: unknown[]): void {
    const currentHook = this._hooks[this._hookIndex++];

    if (currentHook !== undefined) {
      ensureHookType<EffectHook>(HookType.PassiveEffect, currentHook);

      if (dependenciesAreChanged(currentHook.dependencies, dependencies)) {
        this._queue.passiveEffects.push(new InvokeEffectHook(currentHook));
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
      this._queue.passiveEffects.push(new InvokeEffectHook(hook));
    }
  }

  useId(): string {
    let currentHook = this._hooks[this._hookIndex++];

    if (currentHook !== undefined) {
      ensureHookType<IdentifierHook>(HookType.Identifier, currentHook);
    } else {
      currentHook = {
        type: HookType.Identifier,
        id: this._host.nextIdentifier(),
      };
      this._hooks.push(currentHook);
    }

    return ':' + this._host.getHostName() + '-' + currentHook.id + ':';
  }

  useInsertionEffect(callback: EffectCallback, dependencies?: unknown[]): void {
    const currentHook = this._hooks[this._hookIndex++];

    if (currentHook !== undefined) {
      ensureHookType<EffectHook>(HookType.InsertionEffect, currentHook);

      if (dependenciesAreChanged(currentHook.dependencies, dependencies)) {
        this._queue.mutationEffects.push(new InvokeEffectHook(currentHook));
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
      this._queue.mutationEffects.push(new InvokeEffectHook(hook));
    }
  }

  useLayoutEffect(callback: EffectCallback, dependencies?: unknown[]): void {
    const currentHook = this._hooks[this._hookIndex++];

    if (currentHook !== undefined) {
      ensureHookType<EffectHook>(HookType.LayoutEffect, currentHook);

      if (dependenciesAreChanged(currentHook.dependencies, dependencies)) {
        this._queue.layoutEffects.push(new InvokeEffectHook(currentHook));
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
      this._queue.layoutEffects.push(new InvokeEffectHook(hook));
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
  ): [TState, (action: TAction, priority?: TaskPriority) => void] {
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
        dispatch: (action: TAction, priority?: TaskPriority) => {
          const nextState = reducer(hook.state, action);
          if (!Object.is(hook.state, nextState)) {
            hook.state = nextState;
            this.forceUpdate(priority);
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
          this.forceUpdate(priority);
        }),
      [subscribe, priority],
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

function use<TResult>(
  usable: Usable<TResult, RenderContext>,
  context: RenderContext,
): TResult {
  return usableTag in usable ? usable[usableTag](context) : usable(context);
}
