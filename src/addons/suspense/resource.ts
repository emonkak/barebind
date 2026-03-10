import { LRUMap } from '../../collections/lru-map.js';
import type { HookFunction } from '../../core.js';
import { Suspend } from './suspend.js';

export function Resource<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  dependencies: unknown[] = [],
): HookFunction<Suspend<T>> {
  return (context) => {
    return context.useMemo(() => {
      const controller = new AbortController();
      const promise = fetcher(controller.signal);
      return Suspend.await(promise, controller);
    }, dependencies);
  };
}

export interface ResourceLoader<TKey, TResult> {
  getOrFetch(key: TKey): Suspend<TResult>;
  getOrRefetch(key: TKey): Suspend<TResult>;
  invalidate(key: TKey): Suspend<TResult> | undefined;
  peek(key: TKey): Suspend<TResult> | undefined;
  refetch(key: TKey): Suspend<TResult>;
  reset(): void;
}

export interface ResourceLoaderOptions {
  capacity?: number;
}

export function ResourceLoader<TKey, TResult>(
  fetcher: (key: TKey, signal: AbortSignal) => Promise<TResult>,
  { capacity = 1 }: ResourceLoaderOptions = {},
): HookFunction<ResourceLoader<TKey, TResult>> {
  return (context) => {
    const cachedSuspends = context.useMemo(
      () =>
        new LRUMap<TKey, Suspend<TResult>>(capacity, ({ value }) => {
          value.abort();
        }),
      [],
    );

    if (cachedSuspends.capacity !== capacity) {
      cachedSuspends.resize(capacity);
    }

    const startFetch = (key: TKey) => {
      const controller = new AbortController();
      const promise = fetcher(key, controller.signal);
      return Suspend.await(promise, controller);
    };

    return {
      getOrFetch: (key) => {
        return cachedSuspends.getOrInsertComputed(key, startFetch);
      },
      getOrRefetch: (key) => {
        let suspend = cachedSuspends.get(key);
        if (suspend?.status !== 'pending') {
          suspend = startFetch(key);
          cachedSuspends.set(key, suspend);
        }
        return suspend;
      },
      invalidate: (key) => {
        const suspend = cachedSuspends.delete(key);
        suspend?.abort();
        return suspend;
      },
      peek: (key) => {
        return cachedSuspends.get(key);
      },
      refetch: (key) => {
        const suspend = startFetch(key);
        cachedSuspends.set(key, suspend)?.abort();
        return suspend;
      },
      reset: () => {
        for (const suspend of cachedSuspends.values()) {
          suspend.abort();
        }
        cachedSuspends.clear();
      },
    };
  };
}
