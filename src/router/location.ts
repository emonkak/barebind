import type { RenderContext } from '../renderContext.js';
import { RelativeURL } from './url.js';

export interface LocationState {
  readonly url: RelativeURL;
  readonly state: unknown;
  readonly type: LocationType;
}

export enum LocationType {
  Load,
  Pop,
  Push,
  Replace,
}

export interface LocationActions {
  getCurrentURL(): RelativeURL;
  navigate(url: RelativeURL, options?: NavigateOptions): void;
}

export interface NavigateOptions {
  replace?: boolean;
  state?: unknown;
}

export function browserLocation(
  context: RenderContext,
): readonly [LocationState, LocationActions] {
  const [locationState, setLocationState] = context.useState<LocationState>(
    () => ({
      url: RelativeURL.fromLocation(location),
      state: history.state,
      type: LocationType.Load,
    }),
  );
  const locationActions = context.useMemo<LocationActions>(
    () => ({
      getCurrentURL: () => RelativeURL.fromLocation(location),
      navigate: (
        url: RelativeURL,
        { replace = false, state = null }: NavigateOptions = {},
      ) => {
        let type: LocationType;
        if (replace) {
          history.replaceState(state, '', url.toString());
          type = LocationType.Replace;
        } else {
          history.pushState(state, '', url.toString());
          type = LocationType.Push;
        }
        setLocationState({
          url,
          state,
          type,
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
          type: LocationType.Pop,
        };
      });
    };
    const handleClick = createBrowserClickHandler(locationActions);
    const handleSubmit = createBrowserSubmitHandler(locationActions);
    addEventListener('popstate', handlePopState);
    addEventListener('click', handleClick);
    addEventListener('submit', handleSubmit);
    return () => {
      removeEventListener('popstate', handlePopState);
      removeEventListener('click', handleClick);
      removeEventListener('submit', handleSubmit);
    };
  }, []);

  const value = [locationState, locationActions] as const;

  context.setContextValue(currentLocation, value);

  return value;
}

export function currentLocation(
  context: RenderContext,
): readonly [LocationState, LocationActions] {
  const value = context.getContextValue(currentLocation);

  if (value == null) {
    throw new Error(
      'A context value for the current location does not exist, please ensure it is registered by context.use() with browserLocation or hashLocation.',
    );
  }

  return value as [LocationState, LocationActions];
}

export function hashLocation(
  context: RenderContext,
): readonly [LocationState, LocationActions] {
  const [locationState, setLocationState] = context.useState<LocationState>(
    () => ({
      url: RelativeURL.fromString(trimHash(location.hash)),
      state: history.state,
      type: LocationType.Load,
    }),
  );
  const locationActions = context.useMemo<LocationActions>(
    () => ({
      getCurrentURL: () => RelativeURL.fromString(trimHash(location.hash)),
      navigate: (
        url: RelativeURL,
        { replace = false, state = null }: NavigateOptions = {},
      ) => {
        let type: LocationType;
        if (replace) {
          history.replaceState(state, '', '#' + url.toString());
          type = LocationType.Replace;
        } else {
          history.pushState(state, '', '#' + url.toString());
          type = LocationType.Push;
        }
        setLocationState({
          url,
          state,
          type,
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
        type: LocationType.Pop,
      });
    };
    // Prevent the default action when hash link is clicked. So, "hashchange"
    // event is canceled and the location type is detected correctly.
    const handleClick = createHashClickHandler(locationActions);
    addEventListener('hashchange', handleHashChange);
    addEventListener('click', handleClick);
    return () => {
      removeEventListener('hashchange', handleHashChange);
      removeEventListener('click', handleClick);
    };
  }, []);

  const value = [locationState, locationActions] as const;

  context.setContextValue(currentLocation, value);

  return value;
}

/**
 * @internal
 */
export function createBrowserClickHandler({
  navigate,
}: LocationActions): (event: MouseEvent) => void {
  return (event) => {
    if (
      isPressedModifierKeys(event) ||
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
}: LocationActions): (event: SubmitEvent) => void {
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
}: LocationActions): (event: MouseEvent) => void {
  return (event) => {
    if (
      isPressedModifierKeys(event) ||
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
  const { url, type } = locationState;

  if (
    type === LocationType.Load ||
    (type === LocationType.Pop && history.scrollRestoration === 'auto')
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

function isInternalLink(element: Element): element is HTMLAnchorElement {
  return (
    element.tagName === 'A' &&
    element.hasAttribute('href') &&
    !element.hasAttribute('target') &&
    !element.hasAttribute('download') &&
    element.getAttribute('rel') !== 'external'
  );
}

function isPressedModifierKeys(event: MouseEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

function trimHash(hash: string): string {
  return hash.startsWith('#') ? hash.slice(1) : hash;
}
