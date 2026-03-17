/// <reference path="../../../typings/upsert.d.ts" />

import { createComponent } from '../../component.js';
import type { RenderContext } from '../../core.js';
import { getTranstionIndex, TransitionLanes } from '../../lane.js';
import { Flexible } from '../../layout/flexible.js';
import { Fragment } from '../../template.js';
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
      suspendRefCounts: new WeakMap<Suspend<unknown>, RefCount>(),
    }),
    [],
  );
  const trackedSuspends = $.useMemo(
    () => new Set<Suspend<unknown>>(),
    [children],
  );

  const areAllSuspendsSettled = () =>
    trackedSuspends.values().every(({ status }) => status !== 'pending');

  $.catchError((errorOrSuspend, handleError) => {
    if (errorOrSuspend instanceof Suspend) {
      const refCount = store.suspendRefCounts.getOrInsertComputed(
        errorOrSuspend,
        () => ({
          count: 0,
        }),
      );

      if (refCount.count++ > 0) {
        return;
      }

      const subsequentUpdate = store.isMounted
        ? $.getSessionContext().getScheduledUpdates()[0]
        : undefined;

      // If the boundary is already mounted and the update is a transition,
      // suppress the fallback and retry once the suspend resolves. Otherwise,
      // show the fallback immediately. This matches React's behavior.
      if (
        subsequentUpdate !== undefined &&
        subsequentUpdate.lanes & TransitionLanes
      ) {
        const { coroutine, lanes } = subsequentUpdate;
        const transition = getTranstionIndex(lanes);
        const forceUpdate = () =>
          $.getSessionContext().scheduleUpdate(coroutine, {
            transition,
          }).finished;
        errorOrSuspend.then(forceUpdate, forceUpdate);
      } else {
        const forceUpdateWhenSettled = () => {
          if (areAllSuspendsSettled()) {
            $.forceUpdate();
          }
        };

        errorOrSuspend.then(forceUpdateWhenSettled, forceUpdateWhenSettled);

        forceUpdateWhenSettled();
      }

      trackedSuspends.add(errorOrSuspend);
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
      for (const suspend of trackedSuspends) {
        const refCount = store.suspendRefCounts.get(suspend);
        if (refCount !== undefined && --refCount.count === 0) {
          suspend.abort();
        }
      }
    };
  }, [trackedSuspends]);

  const shouldRenderChildren = areAllSuspendsSettled();

  return Fragment([
    Flexible(shouldRenderChildren ? children : null),
    Flexible(shouldRenderChildren ? null : fallback),
  ]);
});
