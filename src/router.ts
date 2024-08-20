import type { RenderContext } from './renderContext.js';

export interface Route<
  TResult,
  TPatterns extends Pattern[] = Pattern[],
  TInheritArgs extends unknown[] = [],
> {
  patterns: TPatterns;
  handler: Handler<
    [...TInheritArgs, ...ExtractArgs<TPatterns>],
    TResult
  > | null;
  childRoutes: Route<
    TResult,
    Pattern[],
    [...TInheritArgs, ...ExtractArgs<TPatterns>]
  >[];
}

export type Pattern =
  | string
  | RegExp
  | ((component: string, url: RelativeURL, state: unknown) => any);

export type Handler<TArgs extends any[], TResult> = (
  args: TArgs,
  url: RelativeURL,
  state: unknown,
) => TResult;

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

export interface LocationLike {
  pathname: string;
  search: string;
  hash: string;
}

type ExtractArgs<TPatterns> = TPatterns extends []
  ? []
  : TPatterns extends [infer THead, ...infer TTail]
    ? [...Match<THead>, ...ExtractArgs<TTail>]
    : unknown[];

type Match<TPattern> = TPattern extends string
  ? []
  : TPattern extends RegExp
    ? [string]
    : TPattern extends (
          component: string,
          url: RelativeURL,
          stae: unknown,
        ) => NonNullable<infer TResult> | null
      ? [TResult]
      : never;

export class Router<TResult> {
  private readonly _routes: Route<TResult>[] = [];

  constructor(routes: Route<TResult>[]) {
    this._routes = routes;
  }

  match(url: RelativeURL, state: unknown = null): TResult | null {
    const path = url.pathname;
    const pathWithoutInitialSlash = path[0] === '/' ? path.slice(1) : path;
    const components = pathWithoutInitialSlash.split('/');

    let routes = this._routes;
    let routeIndex = 0;
    let componentIndex = 0;
    let allArgs: unknown[] = [];

    while (routeIndex < routes.length) {
      const { patterns, childRoutes, handler } = routes[routeIndex]!;
      const args = extractArgs(
        patterns,
        components.slice(componentIndex, componentIndex + patterns.length),
        url,
        state,
      );

      if (args !== null) {
        if (components.length === componentIndex + patterns.length) {
          return handler !== null
            ? handler(allArgs.concat(args), url, state)
            : null;
        }
        if (childRoutes.length > 0) {
          allArgs = allArgs.concat(args);
          routes = childRoutes;
          routeIndex = 0;
          componentIndex += patterns.length;
        } else {
          routeIndex++;
        }
      } else {
        routeIndex++;
      }
    }

    return null;
  }
}

export class RelativeURL {
  private readonly _pathname: string;

  private readonly _searchParams: URLSearchParams;

  private readonly _hash: string;

  static from(value: RelativeURL | URL | LocationLike | string): RelativeURL {
    if (value instanceof RelativeURL) {
      return value;
    }
    if (value instanceof URL) {
      return RelativeURL.fromURL(value);
    }
    if (typeof value === 'object') {
      return RelativeURL.fromLocation(value);
    }
    return RelativeURL.fromString(value);
  }

  static fromString(urlString: string): RelativeURL {
    // SAFETY: Relative URLs can always be safely initialized.
    return RelativeURL.fromURL(new URL(urlString, 'file:'));
  }

  static fromLocation(location: LocationLike) {
    const { pathname, search, hash } = location;
    return new RelativeURL(pathname, search, hash);
  }

  static fromURL(url: URL): RelativeURL {
    const { pathname, searchParams, hash } = url;
    return new RelativeURL(pathname, searchParams, hash);
  }

  constructor(
    pathname: string,
    search: ConstructorParameters<typeof URLSearchParams>[0] = '',
    hash = '',
  ) {
    this._pathname = pathname;
    this._searchParams = new URLSearchParams(search);
    this._hash = hash;
  }

  get pathname(): string {
    return this._pathname;
  }

  get search(): string {
    return this._searchParams.size > 0
      ? '?' + this._searchParams.toString()
      : '';
  }

  get searchParams(): URLSearchParams {
    return this._searchParams;
  }

  get hash(): string {
    return this._hash;
  }

  toJSON(): string {
    return this.toString();
  }

  toString(): string {
    return this._pathname + this.search + this._hash;
  }
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
      url: RelativeURL.fromString(decodeHash(location.hash)),
      state: history.state,
      type: LocationType.Load,
    }),
  );
  const locationActions = context.useMemo<LocationActions>(
    () => ({
      getCurrentURL: () => RelativeURL.fromString(decodeHash(location.hash)),
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
        url: RelativeURL.fromString(decodeHash(new URL(event.newURL).hash)),
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

    const url = RelativeURL.fromString(decodeHash(element.hash));
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
    const id = decodeHash(url.hash);
    const element = document.getElementById(id);

    if (element !== null) {
      element.scrollIntoView();
      return;
    }
  }

  scrollTo(0, 0);
}

export function integer(component: string): number | null {
  const n = Number.parseInt(component, 10);
  return n.toString() === component ? n : null;
}

export function route<
  TResult,
  const TPatterns extends Pattern[] = Pattern[],
  const TInheritArgs extends unknown[] = [],
>(
  patterns: TPatterns,
  handler: Handler<
    [...TInheritArgs, ...ExtractArgs<TPatterns>],
    TResult
  > | null,
  childRoutes: Route<
    TResult,
    Pattern[],
    [...TInheritArgs, ...ExtractArgs<TPatterns>]
  >[] = [],
): Route<TResult, TPatterns, TInheritArgs> {
  return {
    patterns,
    handler,
    childRoutes,
  };
}

export function wildcard(component: string): string {
  return component;
}

function decodeHash(hash: string): string {
  return decodeURIComponent(hash.slice(1));
}

function extractArgs<TPatterns extends Pattern[]>(
  patterns: TPatterns,
  components: string[],
  url: RelativeURL,
  state: unknown,
): ExtractArgs<TPatterns> | null {
  if (patterns.length !== components.length) {
    return null;
  }
  const args: unknown[] = [];
  for (let i = 0, l = patterns.length; i < l; i++) {
    const pattern = patterns[i]!;
    const component = components[i]!;
    if (typeof pattern === 'string') {
      if (pattern !== component) {
        return null;
      }
    } else if (typeof pattern === 'function') {
      const match = pattern(component, url, state);
      if (match == null) {
        return null;
      }
      args.push(match);
    } else {
      const match = component.match(pattern);
      if (match === null) {
        return null;
      }
      args.push(match[0]);
    }
  }
  return args as ExtractArgs<TPatterns>;
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
