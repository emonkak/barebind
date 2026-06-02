import type { RenderContext, UsableFunction } from '../../component.js';
import { HistoryContext, trimHashMark } from './history.js';

export function ScrollRestration(): UsableFunction<void> {
  return (context: RenderContext) => {
    const { location, navigator } = context.inject(HistoryContext);

    context.useEffect(() => {
      const originalScrollRestoration = history.scrollRestoration;

      if (typeof navigation === 'object') {
        const handleNavigate = (event: NavigateEvent) => {
          if (!event.canIntercept || !navigator.isTransitionRunning) {
            return;
          }

          event.intercept({
            async handler() {
              await navigator.runningTransition;
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

    context.useEffect(() => {
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
    // biome-ignore lint/style/noRestrictedGlobals: intentional global document reference
    const element = document.getElementById(id);

    if (element !== null) {
      element.scrollIntoView();
      return;
    }
  }

  scrollTo(0, 0);
}
