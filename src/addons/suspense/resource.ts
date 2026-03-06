import type { HookFunction } from '../../core.js';
import { Suspend } from './suspend.js';

export const Resource = function Resource<T>(
  fetchResource: (signal: AbortSignal) => Promise<T>,
  dependencies: unknown[] = [],
): HookFunction<Suspend<T>> {
  return (context) => {
    const suspend = context.useMemo(() => {
      const controller = new AbortController();
      const promise = fetchResource(controller.signal);
      return Suspend.await(promise, controller);
    }, dependencies);

    context.useLayoutEffect(() => {
      suspend.retain();
      return () => {
        suspend.release();
      };
    }, [suspend]);

    return suspend;
  };
};
