import { createComponent } from '../../component.js';
import type { RenderContext } from '../../internal.js';
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
  const pendingSuspends = $.useMemo<Suspend<unknown>[]>(() => [], [children]);

  const areSuspendsSettled = () =>
    pendingSuspends.every(
      ({ status }) => status === 'fulfilled' || status === 'rejected',
    );

  $.catchError((error, handleError) => {
    if (error instanceof Suspend) {
      const callback = () => {
        if (areSuspendsSettled()) {
          $.forceUpdate();
        }
      };

      error.then(callback, callback);

      if (pendingSuspends.push(error) === 1) {
        $.forceUpdate();
      }
    } else {
      handleError(error);
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

  const shouldRenderChildren = areSuspendsSettled();

  return Fragment([
    Flexible(shouldRenderChildren ? children : null),
    Flexible(shouldRenderChildren ? null : fallback),
  ]);
});
