export const userHookTag: unique symbol = Symbol('UserHook');

export type InitialState<T> = [T] extends [Function] ? () => T : (() => T) | T;

export type NewState<T> = [T] extends [Function]
  ? (prevState: T) => T
  : ((prevState: T) => T) | T;

export interface HookContext {
  forceUpdate(options?: UpdateOptions): void;
  getContextualValue<T>(key: ContextualKey<T>): T;
  setContextualValue<T>(key: ContextualKey<T>, value: T): void;
  useCallback<T extends () => {}>(callback: T, dependencies: unknown[]): T;
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
  | MemoHook<unknown>
  | ReducerHook<unknown, any>
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
  [userHookTag](context: HookContext): T;
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
  defaultValue: T;
}

export interface RefObject<T> {
  current: T;
}

export interface UpdateOptions {
  priority?: TaskPriority;
  viewTransition?: boolean;
}

export function createContext<T>(): ContextualKey<T | undefined>;
export function createContext<T>(defaultValue: T): ContextualKey<T>;
export function createContext<T>(
  defaultValue?: T,
): ContextualKey<T | undefined> {
  return { defaultValue };
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
