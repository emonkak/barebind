/// <reference types="navigation-api-types" />

import type { CustomHookFunction, ScheduleOptions } from '../../internal.js';
import {
  anyModifiersArePressed,
  CurrentHistory,
  type HistoryLocation,
  type HistoryNavigator,
  isInternalLink,
  trimHash,
} from './history.js';
import { RelativeURL } from './url.js';

const DEFAULT_OPTIONS: ScheduleOptions = {
  mode: 'sequential',
};

export function HashHistory(
  options?: ScheduleOptions,
): CustomHookFunction<readonly [HistoryLocation, HistoryNavigator]> {
  return (context) => {
    const [location, setLocation] = context.useState<HistoryLocation>(() => ({
      url: RelativeURL.fromString(trimHash(window.location.hash)),
      state: history.state,
      navigationType: null,
    }));

    const navigator: HistoryNavigator = context.useMemo(
      () => ({
        getCurrentURL: () =>
          RelativeURL.fromString(trimHash(window.location.hash)),
        isTransitionPending: () => context.isUpdatePending(),
        navigate: (url, { replace = false, state = null } = {}) => {
          setLocation(
            {
              url: RelativeURL.from(url),
              state,
              navigationType: replace ? 'replace' : 'push',
            },
            { ...DEFAULT_OPTIONS, ...options },
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
                  trimHash(new URL(event.destination.url).hash),
                ),
                state: event.destination.getState(),
                navigationType: event.navigationType,
              },
              { ...DEFAULT_OPTIONS, ...options },
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
              url: RelativeURL.fromString(trimHash(new URL(event.newURL).hash)),
              state: history.state,
              navigationType: 'traverse',
            },
            { ...DEFAULT_OPTIONS, ...options },
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

    const currentHistory = [location, navigator] as const;

    context.setContextValue(CurrentHistory, currentHistory);

    return currentHistory;
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
    const url = RelativeURL.fromString(trimHash(element.hash), base);
    const replace =
      element.hasAttribute('data-link-replace') ||
      element.hash === window.location.hash;

    navigate(url, { replace });
  };
}
