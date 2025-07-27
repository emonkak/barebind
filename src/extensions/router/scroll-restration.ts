/// <reference types="navigation-api-types" />

import type { HookContext } from '../../core.js';
import { CurrentHistory, trimHash } from './history.js';

export function ScrollRestration(context: HookContext): void {
  const [location, navigator] = context.use(CurrentHistory);

  context.useLayoutEffect(() => {
    const originalScrollRestoration = history.scrollRestoration;

    if (typeof navigation === 'object') {
      const handleNavigate = (event: NavigateEvent) => {
        if (!event.canIntercept || event.downloadRequest !== null) {
          return;
        }

        event.intercept({
          async handler() {
            if (await navigator.waitForTransition()) {
              event.scroll();
            }
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
}

function resetScrollPosition(hash: string): void {
  if (hash !== '') {
    const id = trimHash(hash);
    const element = document.getElementById(id);

    if (element !== null) {
      element.scrollIntoView();
      return;
    }
  }

  scrollTo(0, 0);
}
