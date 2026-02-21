/// <reference types="navigation-api-types" />

import type { HookFunction, UpdateOptions } from '../../internal.js';
import {
  $currentHistory,
  anyModifiersArePressed,
  type HisotryContext,
  type HistoryLocation,
  type HistoryNavigator,
  isInternalLink,
} from './history.js';
import { RelativeURL } from './relative-url.js';

export function BrowserHistory(
  options?: UpdateOptions,
): HookFunction<HisotryContext> {
  return (context) => {
    const [location, setLocation] = context.useState<HistoryLocation>(() => ({
      url: RelativeURL.fromURL(window.location),
      state: history.state,
      navigationType: null,
    }));

    const navigator = context.useMemo<HistoryNavigator>(
      () => ({
        getCurrentURL: () => RelativeURL.fromURL(window.location),
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
            history.replaceState(state, '', url.toString());
          } else {
            history.pushState(state, '', url.toString());
          }
        },
        async waitForTransition(): Promise<number> {
          return context.waitForUpdate();
        },
      }),
      [],
    );

    context.useLayoutEffect(() => {
      const handleClick = createLinkClickHandler(navigator);
      const handleSubmit = createFormSubmitHandler(navigator);

      if (typeof navigation === 'object') {
        const handleNavigate = (event: NavigateEvent) => {
          if (!event.hashChange) {
            // Ignore an event when the hash has only changed.
            return;
          }

          if (event.navigationType === 'traverse') {
            setLocation(
              {
                url: RelativeURL.fromString(event.destination.url),
                state: event.destination.getState(),
                navigationType: 'traverse',
              },
              { immediate: true, ...options },
            );
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
          const { url } = location;

          if (
            url.pathname === window.location.pathname &&
            url.search === window.location.search
          ) {
            // Ignore an event when the hash has only changed.
            return;
          }

          setLocation(
            {
              url: RelativeURL.fromURL(window.location),
              state: event.state,
              navigationType: 'traverse',
            },
            { immediate: true, ...options },
          );
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

    const handle = { location, navigator };

    context.setSharedContext($currentHistory, handle);

    return handle;
  };
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
