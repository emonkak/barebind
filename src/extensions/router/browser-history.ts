import type { HookContext } from '../../core.js';
import {
  anyModifiersArePressed,
  CurrentHistory,
  type HisotryLocation,
  type HistoryNavigator,
  isInternalLink,
} from './history.js';
import { RelativeURL } from './url.js';

export function BrowserHistory(
  context: HookContext,
): readonly [HisotryLocation, HistoryNavigator] {
  const [historyState, setHistoryState] = context.useState<{
    location: HisotryLocation;
    navigator: HistoryNavigator;
  }>(() => ({
    location: {
      url: RelativeURL.fromURL(window.location),
      state: window.history.state,
      navigationType: null,
    },
    navigator: {
      getCurrentURL: () => RelativeURL.fromURL(window.location),
      navigate: (url, { replace = false, state = null } = {}) => {
        let navigationType: NavigationType;
        if (replace) {
          history.replaceState(state, '', url.toString());
          navigationType = 'replace';
        } else {
          history.pushState(state, '', url.toString());
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
  const { location, navigator } = historyState;

  context.useLayoutEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      setHistoryState((historyState) => {
        const { location, navigator } = historyState;
        if (
          location.url.pathname === window.location.pathname &&
          location.url.search === window.location.search
        ) {
          // Ignore an event when the hash has only changed.
          return historyState;
        }
        return {
          location: {
            url: RelativeURL.fromURL(window.location),
            state: event.state,
            navigationType: 'traverse',
          },
          navigator,
        };
      });
    };
    const handleClick = createLinkClickHandler(navigator);
    const handleSubmit = createFormSubmitHandler(navigator);

    addEventListener('click', handleClick);
    addEventListener('submit', handleSubmit);
    addEventListener('popstate', handlePopState);

    return () => {
      removeEventListener('click', handleClick);
      removeEventListener('submit', handleSubmit);
      removeEventListener('popstate', handlePopState);
    };
  }, []);

  const currentLocation = [location, navigator] as const;

  context.setContextValue(CurrentHistory, currentLocation);

  return currentLocation;
}

export function createLinkClickHandler({
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
      element.origin !== location.origin ||
      element.getAttribute('href')!.startsWith('#')
    ) {
      return;
    }

    event.preventDefault();

    const url = RelativeURL.fromURL(element);
    const replace =
      element.hasAttribute('data-link-replace') ||
      element.href === location.href;

    navigate(url, { replace });
  };
}

export function createFormSubmitHandler({
  navigate,
}: HistoryNavigator): (event: SubmitEvent) => void {
  return (event) => {
    if (event.defaultPrevented) {
      return;
    }

    const form = event.target as HTMLFormElement;
    const submitter = event.submitter as
      | HTMLButtonElement
      | HTMLInputElement
      | null;

    const method = submitter?.formMethod ?? form.method;
    if (method !== 'get') {
      return;
    }

    const action = new URL(submitter?.formAction ?? form.action);
    if (action.origin !== location.origin) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    // Action's search params are replaced with form data.
    const url = new RelativeURL(
      action.pathname,
      new FormData(form, submitter) as any,
      action.hash,
    );
    const replace =
      form.hasAttribute('data-link-replace') ||
      url.toString() === location.href;

    navigate(url, { replace });
  };
}
