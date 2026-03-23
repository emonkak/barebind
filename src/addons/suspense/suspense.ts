/// <reference path="../../../typings/upsert.d.ts" />

import { createComponent } from '../../component.js';
import { getTranstionIndex, TransitionLanes } from '../../lane.js';
import type { RenderContext } from '../../render-context.js';
import { createFragment } from '../../template.js';
import { Suspend } from './suspend.js';

export interface SuspenseProps {
  children: unknown;
  fallback: unknown;
}

interface RefCount {
  count: number;
}

export const Suspense = createComponent(function Suspense(
  { children, fallback }: SuspenseProps,
  $: RenderContext,
): unknown {
  const store = $.useMemo(
    () => ({
      isMounted: false,
      refCounts: new WeakMap<Suspend<unknown>, RefCount>(),
    }),
    [],
  );
  const trackingSuspends = $.useMemo(
    () => new Set<Suspend<unknown>>(),
    [children],
  );

  const areAllSuspendsSettled = () =>
    trackingSuspends.values().every(({ status }) => status !== 'pending');

  $.catchError((errorOrSuspend, handleError) => {
    if (errorOrSuspend instanceof Suspend) {
      const refCount = store.refCounts.getOrInsertComputed(
        errorOrSuspend,
        () => ({
          count: 0,
        }),
      );

      if (refCount.count++ > 0) {
        return;
      }

      // If the boundary is already mounted and the update is a transition,
      // suppress the fallback and retry once the suspend resolves. Otherwise,
      // show the fallback immediately. This matches React's behavior.
      const updateInProgress = store.isMounted
        ? $.getSessionContext().getScheduledUpdates()[0]
        : undefined;

      if (
        updateInProgress !== undefined &&
        updateInProgress.lanes & TransitionLanes
      ) {
        const { coroutine, lanes } = updateInProgress;
        const transition = getTranstionIndex(lanes);
        const rescheduleUpdate = () =>
          $.getSessionContext().scheduleUpdate(coroutine, {
            transition,
          }).finished;
        errorOrSuspend.then(rescheduleUpdate, rescheduleUpdate);
      } else {
        const forceUpdateWhenSettled = () =>
          areAllSuspendsSettled() ? $.forceUpdate().finished : undefined;
        errorOrSuspend.then(forceUpdateWhenSettled, forceUpdateWhenSettled);
        forceUpdateWhenSettled();
      }

      trackingSuspends.add(errorOrSuspend);
    } else {
      handleError(errorOrSuspend);
    }
  });

  $.useLayoutEffect(() => {
    store.isMounted = true;
    return () => {
      store.isMounted = false;
    };
  }, []);

  $.useLayoutEffect(() => {
    return () => {
      for (const suspend of trackingSuspends) {
        const refCount = store.refCounts.get(suspend);
        if (refCount !== undefined && --refCount.count === 0) {
          suspend.abort();
        }
      }
    };
  }, [trackingSuspends]);

  const shouldRenderChildren = areAllSuspendsSettled();

  return createFragment([
    shouldRenderChildren ? children : null,
    shouldRenderChildren ? null : fallback,
  ]);
});
