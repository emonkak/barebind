import type {
  Cleanup,
  HookFunction,
  InitialState,
  Ref,
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

export function Transition(): HookFunction<
  [
    isPending: boolean,
    startTransition: (action: () => UpdateHandle) => UpdateHandle,
  ]
> {
  return (context) => {
    const [pendingAction, setPendingAction] = context.useState<
      (() => UpdateHandle) | null
    >(null);

    context.useLayoutEffect(() => {
      pendingAction?.().scheduled.then(({ done }) => {
        if (done) {
          setPendingAction(null, { immediate: true });
        }
      });
    }, [pendingAction]);

    const isPending = pendingAction !== null;
    const startTransition = (action: () => UpdateHandle): UpdateHandle => {
      return setPendingAction(() => action);
    };

    return [isPending, startTransition];
  };
}
