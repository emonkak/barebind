import { createContext } from '../contextProvider.js';
import type { ContextualKey, HookContext } from '../hook.js';
import { type UserHook, userHookTag } from '../hook.js';
import { RelativeURL } from './relativeURL.js';

export interface LocationState {
  readonly url: RelativeURL;
  readonly state: unknown;
  readonly navigationType: NavigationType;
}

export interface LocationNavigator {
  getCurrentURL(): RelativeURL;
  navigate(url: RelativeURL, options?: NavigateOptions): void;
}

export type NavigationType =
  | 'initial'
  | 'push'
  | 'reload'
  | 'replace'
  | 'traverse';

export interface NavigateOptions {
  replace?: boolean;
  state?: unknown;
}

const CurrentLocationContext: ContextualKey<
  [LocationState, LocationNavigator]
> = createContext();

export const CurrentLocation: UserHook<
  readonly [LocationState, LocationNavigator]
> = {
  [userHookTag](
    context: HookContext,
  ): readonly [LocationState, LocationNavigator] {
    const value = context.useContext(CurrentLocationContext);

    if (value == undefined) {
      throw new Error(
        'A context value for the current location does not exist, please ensure it is registered by context.use() with browserLocation or hashLocation.',
      );
    }

    return value as [LocationState, LocationNavigator];
  },
};

export const BrowserLocation: UserHook<
  readonly [LocationState, LocationNavigator]
> = {
  [userHookTag](
    context: HookContext,
  ): readonly [LocationState, LocationNavigator] {
    const [locationState, setLocationState] = context.useState<LocationState>(
      () => ({
        url: RelativeURL.fromLocation(location),
        state: history.state,
        navigationType: 'initial',
      }),
    );
    const locationNavigator = context.useMemo<LocationNavigator>(
      () => ({
        getCurrentURL: () => RelativeURL.fromLocation(location),
        navigate: (
          url: RelativeURL,
          { replace = false, state = null }: NavigateOptions = {},
        ) => {
          let navigationType: NavigationType;
          if (replace) {
            history.replaceState(state, '', url.toString());
            navigationType = 'replace';
          } else {
            history.pushState(state, '', url.toString());
            navigationType = 'push';
          }
          setLocationState({
            url,
            state,
            navigationType,
          });
        },
      }),
      [],
    );

    context.useLayoutEffect(() => {
      const handlePopState = (event: PopStateEvent) => {
        setLocationState((prevState) => {
          if (
            prevState.url.pathname === location.pathname &&
            prevState.url.search === location.search
          ) {
            // Ignore an event when the hash has only changed.
            return prevState;
          }
          return {
            url: RelativeURL.fromLocation(location),
            state: event.state,
            navigationType: 'traverse',
          };
        });
      };
      const handleClick = createBrowserClickHandler(locationNavigator);
      const handleSubmit = createBrowserSubmitHandler(locationNavigator);
      addEventListener('popstate', handlePopState);
      addEventListener('click', handleClick);
      addEventListener('submit', handleSubmit);
      return () => {
        removeEventListener('popstate', handlePopState);
        removeEventListener('click', handleClick);
        removeEventListener('submit', handleSubmit);
      };
    }, []);

    return [locationState, locationNavigator] as const;
  },
};

export const HashLocation: UserHook<
  readonly [LocationState, LocationNavigator]
> = {
  [userHookTag](
    context: HookContext,
  ): readonly [LocationState, LocationNavigator] {
    const [locationState, setLocationState] = context.useState<LocationState>(
      () => ({
        url: RelativeURL.fromString(trimHash(location.hash)),
        state: history.state,
        navigationType: 'initial',
      }),
    );
    const locationNavigator = context.useMemo<LocationNavigator>(
      () => ({
        getCurrentURL: () => RelativeURL.fromString(trimHash(location.hash)),
        navigate: (
          url: RelativeURL,
          { replace = false, state = null }: NavigateOptions = {},
        ) => {
          let navigationType: NavigationType;
          if (replace) {
            history.replaceState(state, '', '#' + url.toString());
            navigationType = 'replace';
          } else {
            history.pushState(state, '', '#' + url.toString());
            navigationType = 'push';
          }
          setLocationState({
            url,
            state,
            navigationType,
          });
        },
      }),
      [],
    );

    context.useLayoutEffect(() => {
      // BUGS: "hashchange" event is fired other than when navigating through
      // history entries by back/forward action. For instance, when a link is
      // clicked or a new URL is entered in the address bar. Therefore the
      // location type cannot be detected completely correctly.
      const handleHashChange = (event: HashChangeEvent) => {
        setLocationState({
          url: RelativeURL.fromString(trimHash(new URL(event.newURL).hash)),
          state: history.state,
          navigationType: 'traverse',
        });
      };
      // Prevent the default action when hash link is clicked. So, "hashchange"
      // event is canceled and the location type is detected correctly.
      const handleClick = createHashClickHandler(locationNavigator);
      addEventListener('hashchange', handleHashChange);
      addEventListener('click', handleClick);
      return () => {
        removeEventListener('hashchange', handleHashChange);
        removeEventListener('click', handleClick);
      };
    }, []);

    return [locationState, locationNavigator] as const;
  },
};

/**
 * @internal
 */
export function createBrowserClickHandler({
  navigate,
}: LocationNavigator): (event: MouseEvent) => void {
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

    const url = RelativeURL.fromLocation(element);
    const replace =
      element.hasAttribute('data-link-replace') ||
      element.href === location.href;

    navigate(url, { replace });
  };
}

/**
 * @internal
 */
export function createBrowserSubmitHandler({
  navigate,
}: LocationNavigator): (event: SubmitEvent) => void {
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

/**
 * @internal
 */
export function createHashClickHandler({
  getCurrentURL,
  navigate,
}: LocationNavigator): (event: MouseEvent) => void {
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

export function resetScrollPosition(locationState: LocationState): void {
  const { url, navigationType } = locationState;

  if (
    navigationType === 'initial' ||
    ((navigationType === 'reload' || navigationType === 'traverse') &&
      history.scrollRestoration === 'auto')
  ) {
    return;
  }

  if (url.hash !== '') {
    const id = trimHash(url.hash);
    const element = document.getElementById(id);

    if (element !== null) {
      element.scrollIntoView();
      return;
    }
  }

  scrollTo(0, 0);
}

function anyModifiersArePressed(event: MouseEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

function isInternalLink(element: Element): element is HTMLAnchorElement {
  return (
    element.tagName === 'A' &&
    element.hasAttribute('href') &&
    !element.hasAttribute('target') &&
    !element.hasAttribute('download') &&
    element.getAttribute('rel') !== 'external'
  );
}

function trimHash(hash: string): string {
  return hash.startsWith('#') ? hash.slice(1) : hash;
}
