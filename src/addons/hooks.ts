import type {
  Cleanup,
  HookFunction,
  InitialState,
  Ref,
  UpdateOptions,
} from '../core.js';

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
  startTransition: <T>(action: (transition: number) => T) => T,
];

export function Transition(): HookFunction<TransitionReturn> {
  return (context) => {
    const [isPending, setIsPending] = context.useState(false);

    const startTransition: TransitionReturn[1] = (action) => {
      return context.startTransition((transition) => {
        const complete = () => {
          setIsPending(false, { transition });
        };
        setIsPending(true, { immediate: true });
        const result = action(transition);
        if (result instanceof Promise) {
          result.then(complete, complete);
        } else {
          complete();
        }
        return result;
      });
    };

    return [isPending, startTransition];
  };
}
