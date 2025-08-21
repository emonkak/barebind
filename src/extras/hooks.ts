import type { Cleanup, CustomHookFunction, InitialState } from '../internal.js';
import { Atom, Computed, type Signal, type UnwrapSignals } from './signal.js';

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
        mode: 'prioritized',
        priority: 'background',
      });
    }, [value]);

    return deferredValue;
  };
}

export function EffectEvent<TCallback extends (...args: any[]) => any>(
  callback: TCallback,
): CustomHookFunction<
  (...args: Parameters<TCallback>) => ReturnType<TCallback>
> {
  return (context) => {
    const callbackRef = context.useRef<TCallback | null>(null);

    context.useLayoutEffect(() => {
      callbackRef.current = callback;
    }, [callback]);

    // React's useEffectEvent() returns an unstable callback, but our
    // implementation returns a stable callback.
    return context.useCallback((...args) => callbackRef.current!(...args), []);
  };
}

export function LocalAtom<T>(initialValue: T): CustomHookFunction<Atom<T>> {
  return (context) => {
    return context.useMemo(() => new Atom(initialValue), []);
  };
}

export function LocalComputed<
  TResult,
  const TDependencies extends readonly Signal<any>[],
>(
  computation: (...values: UnwrapSignals<TDependencies>) => TResult,
  dependencies: TDependencies,
): CustomHookFunction<Computed<TResult, TDependencies>> {
  return (context) => {
    return context.useMemo(
      () => new Computed(computation, dependencies),
      dependencies,
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
