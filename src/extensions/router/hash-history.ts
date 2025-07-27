import type { HookContext } from '../../core.js';
import {
  anyModifiersArePressed,
  CurrentHistory,
  type HisotryLocation,
  type HistoryNavigator,
  isInternalLink,
  trimHash,
} from './history.js';
import { RelativeURL } from './url.js';

export function HashHistory(
  context: HookContext,
): readonly [HisotryLocation, HistoryNavigator] {
  const [hisotryState, setHistoryState] = context.useState<{
    location: HisotryLocation;
    navigator: HistoryNavigator;
  }>(() => ({
    location: {
      url: RelativeURL.fromString(trimHash(window.location.hash)),
      state: window.history.state,
      navigationType: null,
    },
    navigator: {
      getCurrentURL: () =>
        RelativeURL.fromString(trimHash(window.location.hash)),
      navigate: (url, { replace = false, state = null } = {}) => {
        let navigationType: NavigationType;
        if (replace) {
          history.replaceState(state, '', '#' + url);
          navigationType = 'replace';
        } else {
          history.pushState(state, '', '#' + url);
          navigationType = 'push';
        }
        const location = {
          url: RelativeURL.from(url),
          state,
          navigationType,
        };
        setHistoryState(({ navigator }) => ({
          location,
          navigator,
        }));
      },
    },
  }));
  const { location, navigator } = hisotryState;

  context.useLayoutEffect(() => {
    // Prevent the default action when hash link is clicked. So, "hashchange"
    // event is canceled and the location type is detected correctly.
    const handleClick = createHashClickHandler(navigator);
    // BUGS: "hashchange" event is fired other than when navigating through
    // history entries by back/forward action. For instance, when a link is
    // clicked or a new URL is entered in the address bar. Therefore the
    // location type cannot be detected completely correctly.
    const handleHashChange = (event: HashChangeEvent) => {
      setHistoryState(({ navigator }) => ({
        location: {
          url: RelativeURL.fromString(trimHash(new URL(event.newURL).hash)),
          state: history.state,
          navigationType: 'traverse',
        },
        navigator,
      }));
    };

    addEventListener('click', handleClick);
    addEventListener('hashchange', handleHashChange);

    return () => {
      removeEventListener('click', handleClick);
      removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const currentHistory = [location, navigator] as const;

  context.setContextValue(CurrentHistory, currentHistory);

  return currentHistory;
}

export function createHashClickHandler({
  getCurrentURL,
  navigate,
}: HistoryNavigator): (event: MouseEvent) => void {
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
      element.hash === location.hash;

    navigate(url, { replace });
  };
}
