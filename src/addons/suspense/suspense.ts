/// <reference path="../../../typings/upsert.d.ts" />

import { createComponent } from '../../component.js';
import { Lane, type RenderContext } from '../../core.js';
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
  const trackedSuspends = $.useMemo<Set<Suspend<unknown>>>(
    () => new Set(),
    [children],
  );
  const suspendRefCounts = $.useMemo<WeakMap<Suspend<unknown>, RefCount>>(
    () => new Map(),
    [],
  );

  const areAllSuspendsSettled = () =>
    trackedSuspends.values().every(({ status }) => status !== 'pending');

  $.catchError((errorOrSuspend, handleError) => {
    if (errorOrSuspend instanceof Suspend) {
      const refCount = suspendRefCounts.getOrInsertComputed(
        errorOrSuspend,
        () => ({
          count: 0,
        }),
      );

      if (refCount.count++ > 0) {
        return;
      }

      const renderLanes =
        $.getSessionContext().getPendingUpdates()[0]?.lanes ?? Lane.NoLane;

      if (!(renderLanes & Lane.TransitionLane)) {
        const updateWhenSettled = () => {
          if (areAllSuspendsSettled()) {
            $.forceUpdate();
          }
        };

        errorOrSuspend.then(updateWhenSettled, (error) => {
          updateWhenSettled();
          if (errorOrSuspend.status !== 'aborted') {
            $.throwError(error);
          }
        });

        updateWhenSettled();
      }

      trackedSuspends.add(errorOrSuspend);
    } else {
      handleError(errorOrSuspend);
    }
  });

  $.useLayoutEffect(() => {
    return () => {
      for (const suspend of trackedSuspends) {
        const refCount = suspendRefCounts.get(suspend);
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
