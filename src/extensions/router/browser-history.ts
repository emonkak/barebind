/// <reference types="navigation-api-types" />

import type { HookContext } from '../../core.js';
import {
  anyModifiersArePressed,
  CurrentHistory,
  type HistoryLocation,
  type HistoryNavigator,
  isInternalLink,
} from './history.js';
import { RelativeURL } from './url.js';

export function BrowserHistory(
  context: HookContext,
): readonly [HistoryLocation, HistoryNavigator] {
  const historyState = context.useMemo<{
    location: HistoryLocation;
    navigator: HistoryNavigator;
    setLocation: (newLocation: HistoryLocation) => void;
  }>(() => {
    const setLocation = (newLocation: HistoryLocation) => {
      context.forceUpdate();
      historyState.location = newLocation;
    };
    return {
      location: {
        url: RelativeURL.fromURL(window.location),
        state: history.state,
        navigationType: null,
      },
      navigator: {
        getCurrentURL: () => RelativeURL.fromURL(window.location),
        navigate: (url, { replace = false, state = null } = {}) => {
          setLocation({
            url: RelativeURL.from(url),
            state,
            navigationType: replace ? 'replace' : 'push',
          });

          if (replace) {
            history.replaceState(state, '', url.toString());
          } else {
            history.pushState(state, '', url.toString());
          }
        },
        async waitForTransition(): Promise<boolean> {
          return (await context.waitForUpdate()) > 0;
        },
      },
      setLocation,
    };
  }, []);

  context.useLayoutEffect(() => {
    const handleClick = createLinkClickHandler(historyState.navigator);
    const handleSubmit = createFormSubmitHandler(historyState.navigator);

    if (typeof navigation === 'object') {
      const handleNavigate = (event: NavigateEvent) => {
        if (!event.hashChange) {
          // Ignore an event when the hash has only changed.
          return;
        }

        if (event.navigationType === 'traverse') {
          historyState.setLocation({
            url: RelativeURL.fromString(event.destination.url),
            state: event.destination.getState(),
            navigationType: 'traverse',
          });
        }
      };

      addEventListener('click', handleClick);
      addEventListener('submit', handleSubmit);
      navigation.addEventListener('navigate', handleNavigate);

      return () => {
        removeEventListener('click', handleClick);
        removeEventListener('submit', handleSubmit);
        navigation.removeEventListener('navigate', handleNavigate);
      };
    } else {
      const handlePopState = (event: PopStateEvent) => {
        const { url } = historyState.location;

        if (
          url.pathname === window.location.pathname &&
          url.search === window.location.search
        ) {
          // Ignore an event when the hash has only changed.
          return;
        }

        historyState.setLocation({
          url: RelativeURL.fromURL(window.location),
          state: event.state,
          navigationType: 'traverse',
        });
      };

      addEventListener('click', handleClick);
      addEventListener('submit', handleSubmit);
      addEventListener('popstate', handlePopState);

      return () => {
        removeEventListener('click', handleClick);
        removeEventListener('submit', handleSubmit);
        removeEventListener('popstate', handlePopState);
      };
    }
  }, []);

  const currentHistory = [
    historyState.location,
    historyState.navigator,
  ] as const;

  context.setContextValue(CurrentHistory, currentHistory);

  return currentHistory;
}

export function createLinkClickHandler({
  navigate,
}: Pick<HistoryNavigator, 'navigate'>): (event: MouseEvent) => void {
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
      element.origin !== window.location.origin ||
      element.getAttribute('href')!.startsWith('#')
    ) {
      return;
    }

    event.preventDefault();

    const url = RelativeURL.fromURL(element);
    const replace =
      element.hasAttribute('data-link-replace') ||
      element.href === window.location.href;

    navigate(url, { replace });
  };
}

export function createFormSubmitHandler({
  navigate,
}: Pick<HistoryNavigator, 'navigate'>): (event: SubmitEvent) => void {
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
    if (action.origin !== window.location.origin) {
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
      url.toString() === window.location.href;

    navigate(url, { replace });
  };
}
