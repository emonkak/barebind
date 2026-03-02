import type {
  Action,
  Cleanup,
  HookFunction,
  InitialState,
  NextState,
  ReducerHandle,
  Ref,
  StateHandle,
  UpdateHandle,
} from '../internal.js';

export function DeferredValue<T>(
  value: T,
  initialValue?: InitialState<T>,
): HookFunction<T> {
  return (context) => {
    const [deferredValue, setDeferredValue] = context.useState(
      initialValue ?? ((() => value) as InitialState<T>),
    );

    context.useLayoutEffect(() => {
      setDeferredValue(() => value, {
        priority: 'background',
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

export function Optimistic<TState>(
  state: TState,
): HookFunction<StateHandle<TState>>;
export function Optimistic<TState, TAction>(
  state: TState,
  reducer: (state: TState, action: TAction) => TState,
): HookFunction<ReducerHandle<TState, TAction>>;
export function Optimistic<TState, TAction>(
  state: TState,
  reducer?: (state: TState, action: TAction) => TState,
): HookFunction<StateHandle<TState> | ReducerHandle<TState, TAction>> {
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

    context.catchError((error, handleError) => {
      dispatch(() => state);
      handleError(error);
    });

    return [optimisticState, dispatch, isPending];
  };
}

export function Transition(): HookFunction<
  [isPending: boolean, startTransition: (action: Action) => UpdateHandle]
> {
  return (context) => {
    const [pendingAction, setPendingAction] = context.useState<Action | null>(
      null,
    );

    context.useLayoutEffect(() => {
      if (pendingAction !== null) {
        const invokeAction = async (action: Action) => {
          try {
            await action();
          } catch (error) {
            context.throwError(error);
          } finally {
            setPendingAction(null, { immediate: true });
          }
        };
        invokeAction(pendingAction);
      }
    }, [pendingAction]);

    const isPending = pendingAction !== null;
    const startTransition = (action: Action): UpdateHandle => {
      return setPendingAction(() => action);
    };

    return [isPending, startTransition];
  };
}
