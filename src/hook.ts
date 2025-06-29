/// <reference path="../typings/scheduler.d.ts" />

export const $customHook: unique symbol = Symbol('$customHook');

export type Hook =
  | EffectHook
  | IdentifierHook
  | MemoHook<unknown>
  | ReducerHook<any, any>
  | FinalizerHook;

export const HookType = {
  Effect: 0,
  Identifier: 1,
  Memo: 2,
  Reducer: 3,
  Finalizer: 4,
} as const;

export type HookType = (typeof HookType)[keyof typeof HookType];

export const CommitPhase = {
  Mutation: 0,
  Layout: 1,
  Passive: 2,
} as const;

export type CommitPhase = (typeof CommitPhase)[keyof typeof CommitPhase];

export interface EffectHook {
  type: typeof HookType.Effect;
  phase: CommitPhase;
  callback: () => (() => void) | void;
  cleanup: (() => void) | void;
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
  lanes: Lanes;
  reducer: (state: TState, action: TAction) => TState;
  pendingState: TState;
  memoizedState: TState;
  dispatch: (action: TAction) => void;
}

export interface FinalizerHook {
  type: typeof HookType.Finalizer;
}

export interface CustomHook<T> {
  [$customHook](context: HookContext): T;
}

export type UseCustomHooks<THooks extends readonly CustomHook<unknown>[]> = {
  [K in keyof THooks]: THooks[K] extends CustomHook<infer T> ? T : never;
};

export interface HookContext {
  forceUpdate(options?: UpdateOptions): UpdateTask;
  getContextValue(key: unknown): unknown;
  setContextValue(key: unknown, value: unknown): void;
  use<T>(hook: CustomHook<T>): T;
  use<THooks extends readonly CustomHook<unknown>[]>(
    hooks: THooks,
  ): UseCustomHooks<THooks>;
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
  useSyncEnternalStore<TSnapshot>(
    subscribe: (subscruber: () => void) => (() => void) | void,
    getSnapshot: () => TSnapshot,
    options?: UpdateOptions,
  ): TSnapshot;
}

export const Lane = {
  UserInput: 1,
  ContinuousInput: 2,
  Idle: 3,
} as const;

export type Lane = (typeof Lane)[keyof typeof Lane];

export const NO_LANES: Lanes = 0;
export const ALL_LANES: Lanes = -1;

export type Lanes = number;

export interface UpdateOptions {
  priority?: TaskPriority;
  viewTransition?: boolean;
}

export interface UpdateTask {
  priority: TaskPriority;
  promise: Promise<void>;
}

export type InitialState<T> = [T] extends [Function] ? () => T : (() => T) | T;

export type NewState<T> = [T] extends [Function]
  ? (prevState: T) => T
  : ((prevState: T) => T) | T;

export interface RefObject<T> {
  current: T;
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
