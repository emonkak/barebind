import { createComponent } from '../../component.js';
import { Lane, type RenderContext } from '../../core.js';
import { Flexible } from '../../layout/flexible.js';
import { Fragment } from '../../template.js';
import { Suspend } from './suspend.js';

export interface SuspenseProps {
  children: unknown;
  fallback: unknown;
}

export const Suspense = createComponent(function Suspense(
  { children, fallback }: SuspenseProps,
  $: RenderContext,
): unknown {
  const pendingSuspends = $.useMemo<Set<Suspend<unknown>>>(
    () => new Set(),
    [children],
  );

  const areAllSuspendsSettled = () =>
    pendingSuspends.values().every(({ status }) => status !== 'pending');

  $.catchError((errorOrSuspend, handleError) => {
    if (errorOrSuspend instanceof Suspend) {
      if (pendingSuspends.has(errorOrSuspend)) {
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

        errorOrSuspend.then(updateWhenSettled, updateWhenSettled);

        updateWhenSettled();
      }

      pendingSuspends.add(errorOrSuspend);
    } else {
      handleError(errorOrSuspend);
    }
  });

  $.useLayoutEffect(() => {
    for (const suspend of pendingSuspends) {
      suspend.retain();
    }
    return () => {
      for (const suspend of pendingSuspends) {
        suspend.release();
      }
    };
  }, [pendingSuspends]);

  const shouldRenderChildren = areAllSuspendsSettled();

  return Fragment([
    Flexible(shouldRenderChildren ? children : null),
    Flexible(shouldRenderChildren ? null : fallback),
  ]);
});
