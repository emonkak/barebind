/// <reference path="../../../typings/upsert.d.ts" />

import { createComponent } from '../../component.js';
import type { RenderContext } from '../../core.js';
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

      const insideUpdate = $.getInsideUpdate();

      // If the current update is a transition originating from within this
      // scope, prevent the fallback and retry the update after the suspend
      // resolves.
      // Note: Unlike React, whether to show the fallback depends on whether
      // the update originates inside or outside the scope. This is more
      // intuitive and simpler to implement.
      if (insideUpdate?.transition != null) {
        const { coroutine, transition } = insideUpdate;
        const retry = errorOrSuspend.then(
          () =>
            $.getSessionContext().scheduleUpdate(coroutine, { transition })
              .finished,
        );
        transition.suspends.push(retry);
      } else {
        const forceUpdateWhenSettled = () => {
          if (areAllSuspendsSettled()) {
            $.forceUpdate();
          }
        };

        errorOrSuspend.then(forceUpdateWhenSettled, (error) => {
          forceUpdateWhenSettled();
          if (errorOrSuspend.status !== 'aborted') {
            $.throwError(error);
          }
        });

        forceUpdateWhenSettled();
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
