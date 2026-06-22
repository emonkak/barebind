import type {
  DispatchOptions,
  HookFunction,
  InitialState,
} from '../component.js';
import type { Ref } from '../core.js';

export interface DeferredValueOptions<T> extends DispatchOptions<T> {
  initialValue?: InitialState<T>;
}

export function DeferredValue<T>(
  value: T,
  { initialValue, ...dispatchOptions }: DeferredValueOptions<T> = {},
): HookFunction<T> {
  return (context) => {
    const [deferredValue, setDeferredValue] = context.useState(
      initialValue ?? (() => value),
    );

    context.useEffect(() => {
      context.startTransition((transition) => {
        setDeferredValue(() => value, {
          ...dispatchOptions,
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

    context.useEffect(() => {
      callbackRef.current = callback;
    }, [callback]);

    return function (this: ThisType<T>, ...args) {
      return callbackRef.current.apply(this, args);
    };
  };
}

export function ImperativeHandle<T>(
  ref: Ref<T | null> | ((handle: T) => void) | null | undefined,
  createHandle: () => T,
  dependencies?: unknown[],
): HookFunction<void> {
  return (context) => {
    context.useEffect(() => {
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

export function SyncExternalStore<T>(
  subscribe: (subscriber: () => void) => (() => void) | void,
  getSnapshot: () => T,
): HookFunction<void> {
  return (context) => {
    const snapshot = getSnapshot();
    const store = context.useMemo(() => ({ getSnapshot, snapshot }), []);

    context.useEffect(() => {
      store.getSnapshot = getSnapshot;
      store.snapshot = snapshot;

      if (!Object.is(getSnapshot(), snapshot)) {
        context.forceUpdate({ flushSync: true });
      }
    }, [getSnapshot, snapshot]);

    context.useEffect(() => {
      const checkForChanges = () => {
        if (!Object.is(store.getSnapshot(), store.snapshot)) {
          context.forceUpdate({ flushSync: true });
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
    startTransition: <T>(action: (transition: number) => T) => T,
  ]
> {
  return (context) => {
    const [isPending, setIsPending] = context.useState(false);

    const startTransition = <T>(action: (transition: number) => T): T => {
      return context.startTransition((transition) => {
        const endTransition = () => {
          setIsPending(false, { transition });
        };
        setIsPending(true, { flushSync: true });
        const result = action(transition);
        if (result instanceof Promise) {
          result.then(endTransition, endTransition);
        } else {
          endTransition();
        }
        return result;
      });
    };

    return [isPending, startTransition];
  };
}
