/// <reference path="../../typings/scheduler.d.ts" />

export const userHookTag: unique symbol = Symbol('UserHook');

export type Hook =
  | EffectHook
  | IdentifierHook
  | MemoHook<any>
  | ReducerHook<any, any>
  | FinalizerHook;

export const HookType = {
  InsertionEffect: 0,
  LayoutEffect: 1,
  PassiveEffect: 2,
  Identifier: 3,
  Memo: 4,
  Reducer: 5,
  Finalizer: 6,
} as const;

export type HookType = (typeof HookType)[keyof typeof HookType];

export interface EffectHook {
  type:
    | typeof HookType.InsertionEffect
    | typeof HookType.LayoutEffect
    | typeof HookType.PassiveEffect;
  callback: () => VoidFunction | void;
  cleanup: VoidFunction | void;
  dependencies: unknown[] | null;
}

export interface IdentifierHook {
  type: typeof HookType.Identifier;
  id: string;
}

export interface MemoHook<TResult> {
  type: typeof HookType.Memo;
  value: TResult;
  dependencies: unknown[] | null;
}

export interface ReducerHook<TState, TAction> {
  type: typeof HookType.Reducer;
  dispatch: (action: TAction) => void;
  state: TState;
}

export interface FinalizerHook {
  type: typeof HookType.Finalizer;
}

export type InitialState<T> = [T] extends [Function] ? () => T : (() => T) | T;

export type NewState<T> = [T] extends [Function]
  ? (prevState: T) => T
  : ((prevState: T) => T) | T;

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

export type UseUserHooks<THooks> = THooks extends [
  UserHook<infer THead>,
  ...infer TTail,
]
  ? [THead, ...UseUserHooks<TTail>]
  : [];

export interface UserHook<T> {
  [userHookTag](context: HookContext): T;
}

export interface HookContext {
  forceUpdate(options?: UpdateOptions): void;
  getContextualValue<T>(key: ContextualKey<T>): T;
  setContextualValue<T>(key: ContextualKey<T>, value: T): void;
  use<T>(hook: UserHook<T>): T;
  use<T extends UserHook<unknown>[]>(hooks: T): UseUserHooks<T>;
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

export function createContext<T>(): ContextualKey<T | undefined>;
export function createContext<T>(defaultValue: T): ContextualKey<T>;
export function createContext<T>(
  defaultValue?: T,
): ContextualKey<T | undefined> {
  return { defaultValue };
}
