import {
  type Block,
  type Cleanup,
  type Effect,
  type EffectCallback,
  type EffectHook,
  type FinalizerHook,
  type Hook,
  HookType,
  type IdentifierHook,
  type MemoHook,
  type ReducerHook,
  type RefObject,
  RenderFlag,
  type RenderFrame,
  type RenderHost,
  type TaskPriority,
  type TemplateResult,
  UpdateContext,
  type Updater,
  createRenderFrame,
} from './baseTypes.js';
import { dependenciesAreChanged } from './compare.js';
import { LiteralProcessor, type NonLiteralValues } from './literal.js';

export const usableTag: unique symbol = Symbol('Usable');

export type Usable<TResult> = UsableObject<TResult> | UsableCallback<TResult>;

export interface UsableObject<TResult> {
  [usableTag](context: RenderContext): TResult;
}

export type UsableCallback<TResult> = (context: RenderContext) => TResult;

export interface UpdateOptions {
  priority?: TaskPriority;
  viewTransition?: boolean;
}

type UseArray<TArray> = TArray extends [Usable<infer THead>, ...infer TTail]
  ? [THead, ...UseArray<TTail>]
  : [];

type InitialState<TState> = [TState] extends [Function]
  ? () => TState
  : (() => TState) | TState;

type NewState<TState> = [TState] extends [Function]
  ? (prevState: TState) => TState
  : ((prevState: TState) => TState) | TState;

export class RenderContext {
  private readonly _host: RenderHost<RenderContext>;

  private readonly _updater: Updater<RenderContext>;

  private readonly _block: Block<RenderContext>;

  private readonly _frame: RenderFrame<RenderContext>;

  private readonly _hooks: Hook[];

  private readonly _literalProcessor: LiteralProcessor;

  private _hookIndex = 0;

  constructor(
    host: RenderHost<RenderContext>,
    updater: Updater<RenderContext>,
    block: Block<RenderContext>,
    frame: RenderFrame<RenderContext> = createRenderFrame(),
    hooks: Hook[] = [],
    literalProcessor: LiteralProcessor = new LiteralProcessor(),
  ) {
    this._host = host;
    this._updater = updater;
    this._block = block;
    this._frame = frame;
    this._hooks = hooks;
    this._literalProcessor = literalProcessor;
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
  get literalProcessor(): LiteralProcessor {
    return this._literalProcessor;
  }

  /**
   * @internal
   */
  get frame(): RenderFrame<RenderContext> {
    return this._frame;
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
      this._frame,
      this._hooks,
      this._literalProcessor,
    );
  }

  dynamicHTML<TValues extends readonly any[]>(
    strings: TemplateStringsArray,
    ...values: TValues
  ): TemplateResult<NonLiteralValues<TValues>, RenderContext> {
    const { strings: staticStrings, values: dynamicValues } =
      this._literalProcessor.process(strings, values);
    return this._host
      .getTemplate(staticStrings, dynamicValues, 'html')
      .wrapInResult(dynamicValues);
  }

  dynamicMath<TValues extends readonly any[]>(
    strings: TemplateStringsArray,
    ...values: TValues
  ): TemplateResult<NonLiteralValues<TValues>, RenderContext> {
    const { strings: staticStrings, values: dynamicValues } =
      this._literalProcessor.process(strings, values);
    return this._host
      .getTemplate(staticStrings, dynamicValues, 'math')
      .wrapInResult(dynamicValues);
  }

  dynamicSVG<TValues extends readonly any[]>(
    strings: TemplateStringsArray,
    ...values: TValues
  ): TemplateResult<NonLiteralValues<TValues>, RenderContext> {
    const { strings: staticStrings, values: dynamicValues } =
      this._literalProcessor.process(strings, values);
    return this._host
      .getTemplate(staticStrings, dynamicValues, 'svg')
      .wrapInResult(dynamicValues);
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
    this._updater.flushUpdate(this._frame, this._host);
  }

  forceUpdate({
    priority = this._host.getCurrentPriority(),
    viewTransition = false,
  }: UpdateOptions = {}): void {
    const context = new UpdateContext(
      this._host,
      this._updater,
      this._block,
      this._frame,
    );
    if (viewTransition) {
      this._frame.flags |= RenderFlag.ViewTransition;
    }
    this._block.requestUpdate(priority, context);
  }

  getContextValue(key: unknown): unknown {
    return this._host.getScopedValue(key, this._block);
  }

  html<TValues extends readonly any[]>(
    strings: TemplateStringsArray,
    ...values: TValues
  ): TemplateResult<TValues, RenderContext> {
    return this._host.getTemplate(strings, values, 'html').wrapInResult(values);
  }

  isFinalized(): boolean {
    return this._hooks[this._hookIndex - 1]?.type === HookType.Finalizer;
  }

  isRendered(): boolean {
    return this._hooks.at(-1)?.type === HookType.Finalizer;
  }

  math<TValues extends readonly any[]>(
    strings: TemplateStringsArray,
    ...values: TValues
  ): TemplateResult<TValues, RenderContext> {
    return this._host.getTemplate(strings, values, 'math').wrapInResult(values);
  }

  setContextValue(key: unknown, value: unknown): void {
    this._host.setScopedValue(key, value, this._block);
  }

  svg<TValues extends readonly any[]>(
    strings: TemplateStringsArray,
    ...values: TValues
  ): TemplateResult<TValues, RenderContext> {
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

  use<T>(usable: Usable<T>): T;
  use<const TArray extends Usable<any>[]>(usable: TArray): UseArray<TArray>;
  use<T>(usable: Usable<T> | Usable<T>[]): T | T[] {
    if (Array.isArray(usable)) {
      return usable.map((usable) => use(usable, this));
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
      setDeferredValue(value, { priority: 'background' });
    }, [value]);

    return deferredValue;
  }

  useEffect(
    callback: EffectCallback,
    dependencies: unknown[] | null = null,
  ): void {
    const currentHook = this._hooks[this._hookIndex++];

    if (currentHook !== undefined) {
      ensureHookType<EffectHook>(HookType.PassiveEffect, currentHook);

      if (dependenciesAreChanged(currentHook.dependencies, dependencies)) {
        this._frame.passiveEffects.push(new InvokeEffectHook(currentHook));
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
      this._frame.passiveEffects.push(new InvokeEffectHook(hook));
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

  useInsertionEffect(
    callback: EffectCallback,
    dependencies: unknown[] | null = null,
  ): void {
    const currentHook = this._hooks[this._hookIndex++];

    if (currentHook !== undefined) {
      ensureHookType<EffectHook>(HookType.InsertionEffect, currentHook);

      if (dependenciesAreChanged(currentHook.dependencies, dependencies)) {
        this._frame.mutationEffects.push(new InvokeEffectHook(currentHook));
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
      this._frame.mutationEffects.push(new InvokeEffectHook(hook));
    }
  }

  useLayoutEffect(
    callback: EffectCallback,
    dependencies: unknown[] | null = null,
  ): void {
    const currentHook = this._hooks[this._hookIndex++];

    if (currentHook !== undefined) {
      ensureHookType<EffectHook>(HookType.LayoutEffect, currentHook);

      if (dependenciesAreChanged(currentHook.dependencies, dependencies)) {
        this._frame.layoutEffects.push(new InvokeEffectHook(currentHook));
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
      this._frame.layoutEffects.push(new InvokeEffectHook(hook));
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
    subscribe: (subscruber: () => void) => Cleanup | void,
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
  usable: Usable<TResult>,
  context: RenderContext,
): TResult {
  return usableTag in usable ? usable[usableTag](context) : usable(context);
}
