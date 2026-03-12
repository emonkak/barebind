import type {
  Cleanup,
  HookFunction,
  InitialState,
  NextState,
  ReducerReturn,
  Ref,
  StateReturn,
  TransitionAction,
  TransitionHandle,
  UpdateHandle,
  UpdateOptions,
} from '../core.js';

export type ActionStateReturn<TState, TPayload> = [
  state: TState,
  dispatchAction: (
    actionPayload: TPayload,
    options?: UpdateOptions,
  ) => Promise<UpdateHandle>,
  isPending: boolean,
];

export function ActionState<TState, TPayload>(
  reducerAction: (
    previousState: TState,
    actionPayload: TPayload,
  ) => Promise<TState>,
  initialState: Awaited<TState>,
): HookFunction<ActionStateReturn<TState, TPayload>> {
  return (context) => {
    const [state, setState] = context.useState(() => initialState);
    const [isPending, setIsPending] = context.useState(false);
    const store = context.useMemo(
      () => ({
        pendingState: Promise.resolve(initialState) as Promise<TState>,
        dispatchAction: async (
          actionPayload: TPayload,
          options?: UpdateOptions,
        ): Promise<UpdateHandle> => {
          setIsPending(true);
          const previousState = await store.pendingState;
          const nextPendingState = reducerAction(previousState, actionPayload);
          const nextState = await nextPendingState;
          store.pendingState = nextPendingState;
          setIsPending(false, options);
          return setState(() => nextState, options);
        },
      }),
      [],
    );

    return [state, store.dispatchAction, isPending];
  };
}

export interface DeferredValueOptions<T> extends UpdateOptions {
  initialValue?: InitialState<T>;
}

export function DeferredValue<T>(
  value: T,
  { initialValue, ...updateOptions }: DeferredValueOptions<T> = {},
): HookFunction<T> {
  return (context) => {
    const [deferredValue, setDeferredValue] = context.useState(
      initialValue ?? (() => value),
    );

    context.useEffect(() => {
      context.startTransition((transition) => {
        transition.signal.addEventListener(
          'abort',
          () => {
            setDeferredValue(() => value, {
              areStatesEqual: () => false,
            });
          },
          { once: true },
        );
        setDeferredValue(() => value, {
          ...updateOptions,
          transition,
        });
      });
    }, [value]);

    return deferredValue;
  };
}

export function EffectEvent<T extends (...args: any[]) => any>(
  callback: T,
): HookFunction<(...args: Parameters<T>) => ReturnType<T>> {
  return (context) => {
    const callbackRef = context.useRef(callback);

    context.useLayoutEffect(() => {
      callbackRef.current = callback;
    }, [callback]);

    return function (this: ThisType<T>, ...args) {
      return callbackRef.current.apply(this, args);
    };
  };
}

export function ImperativeHandle<T>(
  ref: Ref<T>,
  createHandle: () => T,
  dependencies?: unknown[],
): HookFunction<void> {
  return (context) => {
    context.useLayoutEffect(() => {
      if (typeof ref === 'function') {
        return ref(createHandle());
      } else if (ref != null) {
        ref.current = createHandle();
        return () => {
          ref.current = null;
        };
      }
    }, dependencies?.concat(ref));
  };
}

export function Optimistic<TState>(
  state: TState,
): HookFunction<StateReturn<TState>>;
export function Optimistic<TState, TAction>(
  state: TState,
  reducer: (state: TState, action: TAction) => TState,
): HookFunction<ReducerReturn<TState, TAction>>;
export function Optimistic<TState, TAction>(
  state: TState,
  reducer?: (state: TState, action: TAction) => TState,
): HookFunction<StateReturn<TState> | ReducerReturn<TState, TAction>> {
  return (context) => {
    const [optimisticState, dispatch, isPending] = context.useReducer<
      TState,
      TAction | NextState<TState>
    >(
      (state, action) =>
        typeof action === 'function'
          ? (action as (state: TState) => TState)(state)
          : (reducer?.(state, action as TAction) ?? (action as TState)),
      () => state,
    );

    const optimisticDispatch = (
      action: TAction,
      options?: UpdateOptions,
    ): UpdateHandle => {
      options?.transition?.signal.addEventListener(
        'abort',
        () => {
          dispatch(() => state, { areStatesEqual: () => false });
        },
        { once: true },
      );
      return dispatch(action, options);
    };

    return [optimisticState, optimisticDispatch, isPending];
  };
}

export function SyncEnternalStore<T>(
  subscribe: (subscriber: () => void) => Cleanup | void,
  getSnapshot: () => T,
): HookFunction<void> {
  return (context) => {
    const snapshot = getSnapshot();
    const store = context.useMemo(() => ({ getSnapshot, snapshot }), []);

    context.useLayoutEffect(() => {
      store.getSnapshot = getSnapshot;
      store.snapshot = snapshot;

      if (!Object.is(getSnapshot(), snapshot)) {
        context.forceUpdate();
      }
    }, [getSnapshot, snapshot]);

    context.useEffect(() => {
      const checkForChanges = () => {
        if (!Object.is(store.getSnapshot(), store.snapshot)) {
          context.forceUpdate();
        }
      };
      checkForChanges();
      return subscribe(checkForChanges);
    }, [subscribe]);

    return snapshot;
  };
}

export type TransitionReturn = [
  isPending: boolean,
  startTransition: (action: TransitionAction) => TransitionHandle,
];

export function Transition(): HookFunction<TransitionReturn> {
  return (context) => {
    const [isPending, setIsPending] = context.useState(false);

    const startTransition = (action: TransitionAction): TransitionHandle => {
      return context.startTransition(async (transition) => {
        transition.signal.addEventListener(
          'abort',
          () => {
            setIsPending(false, { areStatesEqual: () => false });
          },
          { once: true },
        );
        await action(transition);
        await setIsPending(true).finished;
        setIsPending(false, { transition });
      });
    };

    return [isPending, startTransition];
  };
}
