import type { HookFunction, RenderContext } from '../../component.js';
import { HistoryContext, trimHashMark } from './history.js';

export function ScrollRestration(
  document: Document = window.document,
): HookFunction<void> {
  return (context: RenderContext) => {
    const { location, navigator } = context.inject(HistoryContext);

    context.useEffect(() => {
      const originalScrollRestoration = history.scrollRestoration;

      if (typeof navigation === 'object') {
        const handleNavigate = (event: NavigateEvent) => {
          if (!event.canIntercept || navigator.transition === null) {
            return;
          }

          event.intercept({
            async handler() {
              await navigator.transition;
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
        resetScrollPosition(document, location.url.hash);
      }
    }, [document, location]);
  };
}

function resetScrollPosition(document: Document, hash: string): void {
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
