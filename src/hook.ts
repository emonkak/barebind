/// <reference path="../typings/scheduler.d.ts" />

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

export const Lane = {
  UserBlocking: 0b1,
  UserVisible: 0b10,
  Background: 0b100,
  Transition: 0b1000,
} as const;

export const NO_LANES: Lanes = 0;
export const ALL_LANES: Lanes = -1;
export const DEFAULT_LANES: Lanes =
  Lane.UserBlocking | Lane.UserVisible | Lane.Background;

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
  onCustomHook(context: HookContext): T;
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
  transition?: boolean;
}

export interface UpdateTask {
  lanes: Lanes;
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

export function getFlushLanesFromOptions(options: UpdateOptions): Lanes {
  let lanes: Lanes;

  switch (options.priority) {
    case 'user-blocking':
      lanes = Lane.UserBlocking;
      break;
    case 'user-visible':
      lanes = Lane.UserBlocking | Lane.UserVisible;
      break;
    case 'background':
      lanes = Lane.UserBlocking | Lane.UserVisible | Lane.Background;
      break;
    default:
      lanes = DEFAULT_LANES;
      break;
  }

  if (options.transition) {
    lanes |= Lane.Transition;
  }

  return lanes;
}

export function getScheduleLanesFromOptions(options: UpdateOptions): Lanes {
  let lanes: Lanes;

  switch (options.priority) {
    case 'user-blocking':
      lanes = Lane.UserBlocking;
      break;
    case 'user-visible':
      lanes = Lane.UserVisible;
      break;
    case 'background':
      lanes = Lane.Background;
      break;
    default:
      lanes = DEFAULT_LANES;
      break;
  }

  if (options.transition) {
    lanes |= Lane.Transition;
  }

  return lanes;
}
