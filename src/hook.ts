/// <reference path="../typings/scheduler.d.ts" />

export const $customHook: unique symbol = Symbol('$customHook');

export type Hook =
  | FinalizerHook
  | EffectHook
  | IdHook
  | MemoHook<any>
  | ReducerHook<any, any>;

export const HookType = {
  Finalizer: 0,
  Effect: 1,
  LayoutEffect: 2,
  InsertionEffect: 3,
  Id: 4,
  Memo: 5,
  Reducer: 6,
} as const;

export type HookType = (typeof HookType)[keyof typeof HookType];

export const NO_LANES: Lanes = 0;
export const ALL_LANES: Lanes = -1;

export const Lane = {
  UserInput: 0b1,
  ContinuousInput: 0b10,
  Idle: 0b100,
} as const;

export type Lane = (typeof Lane)[keyof typeof Lane];

export type Lanes = number;

export interface FinalizerHook {
  type: typeof HookType.Finalizer;
}

export interface EffectHook {
  type:
    | typeof HookType.Effect
    | typeof HookType.LayoutEffect
    | typeof HookType.InsertionEffect;
  callback: () => (() => void) | void;
  cleanup: (() => void) | void;
  dependencies: unknown[] | null;
}

export interface IdHook {
  type: typeof HookType.Id;
  id: string;
}

export interface MemoHook<TResult> {
  type: typeof HookType.Memo;
  value: TResult;
  dependencies: unknown[] | null;
}

export interface ReducerHook<TState, TAction> {
  type: typeof HookType.Reducer;
  lanes: Lanes;
  reducer: (state: TState, action: TAction) => TState;
  pendingState: TState;
  memoizedState: TState;
  dispatch: (action: TAction) => void;
}

export interface CustomHook<T> {
  [$customHook](context: HookContext): T;
}

export type InitialState<T> = [T] extends [Function] ? () => T : (() => T) | T;

export type NewState<T> = [T] extends [Function]
  ? (prevState: T) => T
  : ((prevState: T) => T) | T;

export interface RefObject<T> {
  current: T;
}

export interface UpdateOptions {
  priority?: TaskPriority;
  viewTransition?: boolean;
}

export interface UpdateTask {
  priority: TaskPriority;
  promise: Promise<void>;
}

export interface HookContext {
  forceUpdate(options?: UpdateOptions): UpdateTask;
  getContextValue(key: unknown): unknown;
  setContextValue(key: unknown, value: unknown): void;
  use<T>(hook: CustomHook<T>): T;
  useCallback<T extends Function>(callback: T, dependencies: unknown[]): T;
  useDeferredValue<T>(value: T, initialValue?: InitialState<T>): T;
  useEffect(
    callback: () => (() => void) | void,
    dependencies: unknown[] | null,
  ): void;
  useId(): string;
  useInsertionEffect(
    callback: () => (() => void) | void,
    dependencies: unknown[] | null,
  ): void;
  useLayoutEffect(
    callback: () => (() => void) | void,
    dependencies: unknown[] | null,
  ): void;
  useMemo<T>(factory: () => T, dependencies: unknown[]): T;
  useReducer<TState, TAction>(
    reducer: (state: TState, action: TAction) => TState,
    initialState: InitialState<TState>,
  ): [
    state: TState,
    dispatch: (action: TAction, options?: UpdateOptions) => void,
    isPending: boolean,
  ];
  useRef<T>(initialValue: T): RefObject<T>;
  useState<TState>(
    initialState: InitialState<TState>,
  ): [
    state: TState,
    setState: (newState: NewState<TState>, options?: UpdateOptions) => void,
    isPending: boolean,
  ];
  useSyncEnternalStore<T>(
    subscribe: (subscriber: () => void) => (() => void) | void,
    getSnapshot: () => T,
  ): T;
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

export function getLaneFromPriority(priority: TaskPriority): Lane {
  switch (priority) {
    case 'user-blocking':
      return Lane.UserInput;
    case 'user-visible':
      return Lane.ContinuousInput;
    case 'background':
      return Lane.Idle;
  }
}

export function getLanesFromPriority(priority: TaskPriority): Lanes {
  switch (priority) {
    case 'user-blocking':
      return Lane.UserInput;
    case 'user-visible':
      return Lane.UserInput | Lane.ContinuousInput;
    case 'background':
      return Lane.UserInput | Lane.ContinuousInput | Lane.Idle;
  }
}
