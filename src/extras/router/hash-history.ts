/// <reference types="navigation-api-types" />

import type { CustomHookFunction, UpdateOptions } from '../../internal.js';
import {
  anyModifiersArePressed,
  CurrentHistory,
  type HistoryHandle,
  type HistoryLocation,
  type HistoryNavigator,
  isInternalLink,
  truncateHashMark,
} from './history.js';
import { RelativeURL } from './relative-url.js';

export function HashHistory(
  options?: UpdateOptions,
): CustomHookFunction<HistoryHandle> {
  return (context) => {
    const [location, setLocation] = context.useState<HistoryLocation>(() => ({
      url: RelativeURL.fromString(truncateHashMark(window.location.hash)),
      state: history.state,
      navigationType: null,
    }));

    const navigator: HistoryNavigator = context.useMemo(
      () => ({
        getCurrentURL: () =>
          RelativeURL.fromString(truncateHashMark(window.location.hash)),
        isTransitionPending: () => context.isUpdatePending(),
        navigate: (url, { replace = false, state = null } = {}) => {
          setLocation(
            {
              url: RelativeURL.from(url),
              state,
              navigationType: replace ? 'replace' : 'push',
            },
            { immediate: true, ...options },
          );

          if (replace) {
            history.replaceState(state, '', '#' + url);
          } else {
            history.pushState(state, '', '#' + url);
          }
        },
        async waitForTransition(): Promise<number> {
          return context.waitForUpdate();
        },
      }),
      [],
    );

    context.useLayoutEffect(() => {
      // Prevent the default action when hash link is clicked. So, "hashchange"
      // event is canceled and the location type is detected correctly.
      const handleClick = createHashClickHandler(navigator);

      if (typeof navigation === 'object') {
        const handleNavigate = (event: NavigateEvent) => {
          if (event.hashChange) {
            setLocation(
              {
                url: RelativeURL.fromString(
                  truncateHashMark(new URL(event.destination.url).hash),
                ),
                state: event.destination.getState(),
                navigationType: event.navigationType,
              },
              { immediate: true, ...options },
            );
          }
        };

        addEventListener('click', handleClick);
        navigation.addEventListener('navigate', handleNavigate);

        return () => {
          removeEventListener('click', handleClick);
          navigation.removeEventListener('navigate', handleNavigate);
        };
      } else {
        // BUGS: "hashchange" event will also be fired when a link is clicked or
        // a new URL is entered in the address bar. Therefore the navigation type
        // cannot be detected correctly.
        const handleHashChange = (event: HashChangeEvent) => {
          setLocation(
            {
              url: RelativeURL.fromString(
                truncateHashMark(new URL(event.newURL).hash),
              ),
              state: history.state,
              navigationType: 'traverse',
            },
            { immediate: true, ...options },
          );
        };

        addEventListener('click', handleClick);
        addEventListener('hashchange', handleHashChange);

        return () => {
          removeEventListener('click', handleClick);
          removeEventListener('hashchange', handleHashChange);
        };
      }
    }, []);

    const handle = { location, navigator };

    context.setSharedContext(CurrentHistory, handle);

    return handle;
  };
}

export function createHashClickHandler({
  getCurrentURL,
  navigate,
}: Pick<HistoryNavigator, 'getCurrentURL' | 'navigate'>): (
  event: MouseEvent,
) => void {
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

    const base = getCurrentURL();
    const url = RelativeURL.fromString(truncateHashMark(element.hash), base);
    const replace =
      element.hasAttribute('data-link-replace') ||
      element.hash === window.location.hash;

    navigate(url, { replace });
  };
}
