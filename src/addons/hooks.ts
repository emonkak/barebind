import type {
  Cleanup,
  CustomHookFunction,
  InitialState,
  Ref,
} from '../internal.js';

export function DeferredValue<T>(
  value: T,
  initialValue?: InitialState<T>,
): CustomHookFunction<T> {
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

export function EventCallback<TCallback extends (...args: any[]) => any>(
  callback: TCallback,
): CustomHookFunction<
  (...args: Parameters<TCallback>) => ReturnType<TCallback>
> {
  return (context) => {
    const stableCallback = context.useRef(callback);

    context.useLayoutEffect(() => {
      stableCallback.current = callback;
    }, [callback]);

    // React's useEffectEvent() returns an unstable callback, but our
    // implementation returns a stable callback.
    return context.useCallback(function (this: ThisType<TCallback>, ...args) {
      return stableCallback.current.apply(this, args);
    }, []);
  };
}

export function ImperativeHandle<T>(
  ref: Ref<T>,
  createHandle: () => T,
  dependencies?: unknown[],
): CustomHookFunction<void> {
  return (context) => {
    context.useLayoutEffect(
      () => {
        if (typeof ref === 'function') {
          return ref(createHandle());
        } else if (ref !== null) {
          ref.current = createHandle();
          return () => {
            ref.current = null;
          };
        }
      },
      dependencies !== undefined ? dependencies.concat(ref) : undefined,
    );
  };
}

export function SyncEnternalStore<TSnapshot>(
  subscribe: (subscriber: () => void) => Cleanup | void,
  getSnapshot: () => TSnapshot,
): CustomHookFunction<void> {
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
