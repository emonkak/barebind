export const userHookTag: unique symbol = Symbol('UserHook');

export type InitialState<T> = [T] extends [Function] ? () => T : (() => T) | T;

export type NewState<T> = [T] extends [Function]
  ? (prevState: T) => T
  : ((prevState: T) => T) | T;

export interface HookProtocol {
  forceUpdate(options?: UpdateOptions): void;
  useCallback<T extends () => {}>(callback: T, dependencies: unknown[]): T;
  useContext<T>(key: ContextualKey<T>): T | undefined;
  useDeferredValue<T>(value: T, initialValue?: InitialState<T>): T;
  useEffect(
    callback: () => VoidFunction | void,
    dependencies: unknown[] | null,
  ): void;
  useId(): string;
  useInsertionEffect(
    callback: () => VoidFunction | void,
    dependencies: unknown[] | null,
  ): void;
  useLayoutEffect(
    callback: () => VoidFunction | void,
    dependencies: unknown[] | null,
  ): void;
  useMemo<T>(factory: () => T, dependencies: unknown[]): T;
  useReducer<TState, TAction>(
    reducer: (state: TState, action: TAction) => TState,
    initialState: InitialState<TState>,
  ): [TState, (action: TAction, options?: UpdateOptions) => void];
  useRef<T>(initialValue: T): RefObject<T>;
  useState<TState>(
    initialState: InitialState<TState>,
  ): [TState, (newState: NewState<TState>, options?: UpdateOptions) => void];
  useSyncEnternalStore<T>(
    subscribe: (subscruber: () => void) => VoidFunction | void,
    getSnapshot: () => T,
    options?: UpdateOptions,
  ): T;
}

export type Hook =
  | EffectHook
  | IdentifierHook
  | MemoHook<any>
  | ReducerHook<any, any>
  | FinalizerHook;

export enum HookType {
  InsertionEffect,
  LayoutEffect,
  PassiveEffect,
  Identifier,
  Memo,
  Reducer,
  Finalizer,
}

export interface UserHook<T> {
  [userHookTag](context: HookProtocol): T;
}

export interface EffectHook {
  type:
    | HookType.InsertionEffect
    | HookType.LayoutEffect
    | HookType.PassiveEffect;
  callback: () => VoidFunction | void;
  cleanup: VoidFunction | void;
  dependencies: unknown[] | null;
}

export interface IdentifierHook {
  type: HookType.Identifier;
  id: number;
}

export interface MemoHook<TResult> {
  type: HookType.Memo;
  value: TResult;
  dependencies: unknown[] | null;
}

export interface ReducerHook<TState, TAction> {
  type: HookType.Reducer;
  dispatch: (action: TAction) => void;
  state: TState;
}

export interface FinalizerHook {
  type: HookType.Finalizer;
}

export interface ContextualKey<T> {
  defaultValue?: T | undefined;
}

export interface RefObject<T> {
  current: T;
}

export interface UpdateOptions {
  priority?: TaskPriority;
  viewTransition?: boolean;
}

export function ensureHookType<TExpectedHook extends Hook>(
  expectedType: TExpectedHook['type'],
  hook: Hook,
): asserts hook is TExpectedHook {
  if (hook.type !== expectedType) {
    throw new Error(
      `Unexpected hook type. Expected "${expectedType}" but got "${hook.type}".`,
    );
  }
}
