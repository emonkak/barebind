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
