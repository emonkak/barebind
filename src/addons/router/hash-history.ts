/// <reference types="navigation-api-types" />

import type { UsableFunction } from '../../component.js';
import type { UpdateOptions } from '../../core.js';
import {
  anyModifiersArePressed,
  HistoryContext,
  type HistoryLocation,
  type HistoryNavigator,
  isInternalLink,
  trimHashMark,
} from './history.js';
import { RelativeURL } from './relative-url.js';

export function HashHistory(
  options?: UpdateOptions,
): UsableFunction<HistoryContext> {
  return (context) => {
    const [location, setLocation] = context.useState<HistoryLocation>(() => ({
      url: RelativeURL.fromString(trimHashMark(window.location.hash)),
      state: history.state,
      navigationType: null,
    }));

    const navigator: HistoryNavigator = context.useMemo(
      () => ({
        isTransitionRunning: false as boolean,
        runningTransition: Promise.resolve(),
        getCurrentURL() {
          return RelativeURL.fromString(trimHashMark(window.location.hash));
        },
        navigate(url, { replace = false, state = null } = {}) {
          const handle = setLocation(
            {
              url: RelativeURL.from(url),
              state,
              navigationType: replace ? 'replace' : 'push',
            },
            options,
          );

          handle.finished.finally(() => {
            if (this.runningTransition === handle.finished) {
              this.isTransitionRunning = false;
            }
          });

          this.isTransitionRunning = true;
          this.runningTransition = handle.finished;

          if (replace) {
            history.replaceState(state, '', '#' + url);
          } else {
            history.pushState(state, '', '#' + url);
          }
        },
      }),
      [],
    );

    context.useEffect(() => {
      // Prevent the default action when hash link is clicked. So, "hashchange"
      // event is canceled and the location type is detected correctly.
      const handleClick = createHashClickHandler(navigator);

      if (typeof navigation === 'object') {
        const handleNavigate = (event: NavigateEvent) => {
          if (event.hashChange) {
            setLocation({
              url: RelativeURL.fromString(
                trimHashMark(new URL(event.destination.url).hash),
              ),
              state: event.destination.getState(),
              navigationType: event.navigationType,
            });
          }
        };

        addEventListener('click', handleClick);
        navigation.addEventListener('navigate', handleNavigate);

        return () => {
          removeEventListener('click', handleClick);
          navigation.removeEventListener('navigate', handleNavigate);
        };
      } else {
        // XXX: "hashchange" event will also be fired when a link is clicked or
        // a new URL is entered in the address bar. Therefore the navigation type
        // cannot be detected correctly.
        const handleHashChange = (event: HashChangeEvent) => {
          setLocation({
            url: RelativeURL.fromString(
              trimHashMark(new URL(event.newURL).hash),
            ),
            state: history.state,
            navigationType: 'traverse',
          });
        };

        addEventListener('click', handleClick);
        addEventListener('hashchange', handleHashChange);

        return () => {
          removeEventListener('click', handleClick);
          removeEventListener('hashchange', handleHashChange);
        };
      }
    }, []);

    const historyContext = new HistoryContext(location, navigator);

    context.provide(historyContext);

    return historyContext;
  };
}

export function createHashClickHandler(
  navigator: HistoryNavigator,
): (event: MouseEvent) => void {
  return (event) => {
    if (
      anyModifiersArePressed(event) ||
      event.button !== 0 ||
      event.defaultPrevented
    ) {
      return;
    }

    const element = (event.composedPath() as Element[]).find(isInternalLink);
    if (
      element === undefined ||
      !element.getAttribute('href')!.startsWith('#')
    ) {
      return;
    }

    event.preventDefault();

    const baseUrl = navigator.getCurrentURL();
    const url = RelativeURL.fromString(trimHashMark(element.hash), baseUrl);
    const replace =
      element.hasAttribute('data-link-replace') ||
      element.hash === window.location.hash;

    navigator.navigate(url, { replace });
  };
}
