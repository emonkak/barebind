/// <reference types="navigation-api-types" />

import type { HookFunction, RenderContext } from '../../internal.js';
import { HistoryContext, trimHashMark } from './history.js';

export function ScrollRestration(): HookFunction<void> {
  return (context: RenderContext) => {
    const { location, navigator } = context.use(HistoryContext);

    context.useLayoutEffect(() => {
      const originalScrollRestoration = history.scrollRestoration;

      if (typeof navigation === 'object') {
        const handleNavigate = (event: NavigateEvent) => {
          if (!event.canIntercept || !navigator.isTransitionPending()) {
            return;
          }

          event.intercept({
            async handler() {
              await navigator.waitForTransition();
              event.scroll();
            },
          });
        };

        history.scrollRestoration = 'manual';
        navigation.addEventListener('navigate', handleNavigate);

        return () => {
          history.scrollRestoration = originalScrollRestoration;
          navigation.removeEventListener('navigate', handleNavigate);
        };
      } else {
        history.scrollRestoration = 'auto';

        return () => {
          history.scrollRestoration = originalScrollRestoration;
        };
      }
    }, []);

    context.useLayoutEffect(() => {
      if (
        location.navigationType === 'push' ||
        location.navigationType === 'replace'
      ) {
        resetScrollPosition(location.url.hash);
      }
    }, [location]);
  };
}

function resetScrollPosition(hash: string): void {
  if (hash !== '') {
    const id = trimHashMark(hash);
    const element = document.getElementById(id);

    if (element !== null) {
      element.scrollIntoView();
      return;
    }
  }

  scrollTo(0, 0);
}
