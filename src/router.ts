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
  readonly reason: NavigateReason;
}

export interface LocationActions {
  getCurrentURL(): RelativeURL;
  navigate(url: RelativeURL, options?: NavigateOptions): void;
}

export enum NavigateReason {
  Load,
  Pop,
  Push,
  Replace,
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
      reason: NavigateReason.Load,
    }),
  );
  const locationActions = context.useMemo<LocationActions>(
    () => ({
      getCurrentURL: () => RelativeURL.fromLocation(location),
      navigate: (
        url: RelativeURL,
        { replace = false, state = null }: NavigateOptions = {},
      ) => {
        let reason: NavigateReason;
        if (replace) {
          history.replaceState(state, '', url.toString());
          reason = NavigateReason.Replace;
        } else {
          history.pushState(state, '', url.toString());
          reason = NavigateReason.Push;
        }
        setLocationState({
          url,
          state,
          reason,
        });
      },
    }),
    [],
  );

  context.useLayoutEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      setLocationState({
        url: RelativeURL.fromLocation(location),
        state: event.state,
        reason: NavigateReason.Pop,
      });
    };
    const handleClick = createLinkClickHandler(locationActions);
    const handleSubmit = createFormSubmitHandler(locationActions);
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
      url: RelativeURL.fromString(decodeURIComponent(location.hash.slice(1))),
      state: history.state,
      reason: NavigateReason.Load,
    }),
  );
  const locationActions = context.useMemo<LocationActions>(
    () => ({
      getCurrentURL: () =>
        RelativeURL.fromString(decodeURIComponent(location.hash.slice(1))),
      navigate: (
        url: RelativeURL,
        { replace = false, state = null }: NavigateOptions = {},
      ) => {
        let reason: NavigateReason;
        if (replace) {
          history.replaceState(state, '', '#' + url.toString());
          reason = NavigateReason.Replace;
        } else {
          history.pushState(state, '', '#' + url.toString());
          reason = NavigateReason.Push;
        }
        setLocationState({
          url,
          state,
          reason,
        });
      },
    }),
    [],
  );

  context.useLayoutEffect(() => {
    const hashChangeHandler = () => {
      setLocationState({
        url: RelativeURL.fromString(decodeURIComponent(location.hash.slice(1))),
        state: history.state,
        reason: NavigateReason.Pop,
      });
    };
    addEventListener('hashchange', hashChangeHandler);
    return () => {
      removeEventListener('hashchange', hashChangeHandler);
    };
  }, []);

  const value = [locationState, locationActions] as const;

  context.setContextValue(currentLocation, value);

  return value;
}

/**
 * @internal
 */
export function createFormSubmitHandler({
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
export function createLinkClickHandler({
  navigate,
}: LocationActions): (event: MouseEvent) => void {
  return (event) => {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.button !== 0 ||
      event.defaultPrevented
    ) {
      return;
    }

    // Find a link element excluding nodes in closed shadow trees by
    // composedPath().
    const element = (event.composedPath() as Element[]).find(isLinkElement);
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

export function resetScrollPosition(locationState: LocationState): void {
  const { url, reason } = locationState;

  if (
    reason === NavigateReason.Load ||
    (reason === NavigateReason.Pop && history.scrollRestoration === 'auto')
  ) {
    return;
  }

  if (url.hash !== '') {
    const id = decodeURIComponent(url.hash.slice(1));
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

function isLinkElement(element: Element): element is HTMLAnchorElement {
  return (
    element.tagName === 'A' &&
    element.hasAttribute('href') &&
    !element.hasAttribute('target') &&
    !element.hasAttribute('download') &&
    element.getAttribute('rel') !== 'external'
  );
}
