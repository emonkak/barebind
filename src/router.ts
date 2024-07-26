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

export interface LocationLike {
  pathname: string;
  search: string;
  hash: string;
}

export interface LocationState {
  url: RelativeURL;
  state: unknown;
}

export interface HistoryActions {
  push(url: RelativeURL, state?: unknown): void;
  replace(url: RelativeURL, state?: unknown): void;
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

  dispatch(url: RelativeURL, state: unknown = null): TResult | null {
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

  static fromString(urlString: string): RelativeURL {
    // SAFETY: Relative URLs can always be safely initialized.
    return RelativeURL.fromURL(new URL(urlString, 'file:'));
  }

  static fromLocation(location: LocationLike) {
    const { pathname, search, hash } = location;
    return new RelativeURL(pathname, new URLSearchParams(search), hash);
  }

  static fromURL(url: URL): RelativeURL {
    const { pathname, searchParams, hash } = url;
    return new RelativeURL(pathname, searchParams, hash);
  }

  constructor(
    pathname: string,
    searchParams: URLSearchParams = new URLSearchParams(),
    hash = '',
  ) {
    this._pathname = pathname;
    this._searchParams = searchParams;
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
): [LocationState, HistoryActions] {
  const [locationState, setLocationState] = context.useState(() => ({
    url: RelativeURL.fromLocation(location),
    state: history.state,
  }));
  const historyActions = {
    push(url: RelativeURL, state: unknown = null) {
      history.pushState(state, '', url.toString());
      setLocationState({ url, state });
    },
    replace(url: RelativeURL, state: unknown = null) {
      history.replaceState(state, '', url.toString());
      setLocationState({ url, state });
    },
  };

  context.useEffect(() => {
    const listener = (event: PopStateEvent) => {
      setLocationState({
        url: RelativeURL.fromLocation(location),
        state: event.state,
      });
    };
    addEventListener('popstate', listener);
    return () => {
      removeEventListener('popstate', listener);
    };
  }, []);

  context.setContextValue(currentLocation, [locationState, historyActions]);

  return [locationState, historyActions];
}

export function currentLocation(
  context: RenderContext,
): [LocationState, HistoryActions] {
  const value = context.getContextValue(currentLocation);

  if (value == null) {
    throw new Error(
      'A context value for the current location does not exist, please ensure it is registered by context.use() with browserLocation or hashLocation.',
    );
  }

  return value as [LocationState, HistoryActions];
}

export function hashLocation(
  context: RenderContext,
): [LocationState, HistoryActions] {
  const [locationState, setLocationState] = context.useState(() => ({
    url: RelativeURL.fromString(location.hash.slice(1)),
    state: history.state,
  }));
  const historyActions = {
    push(url: RelativeURL, state: unknown = null) {
      history.pushState(state, '', '#' + url.toString());
      setLocationState({ url, state });
    },
    replace(url: RelativeURL, state: unknown = null) {
      history.replaceState(state, '', '#' + url.toString());
      setLocationState({ url, state });
    },
  };

  context.useEffect(() => {
    const listener = () => {
      setLocationState({
        url: RelativeURL.fromString(location.hash.slice(1)),
        state: history.state,
      });
    };
    addEventListener('hashchange', listener);
    return () => {
      removeEventListener('hashchange', listener);
    };
  }, []);

  context.setContextValue(currentLocation, [locationState, historyActions]);

  return [locationState, historyActions];
}

export function integer(component: string): number | null {
  const n = Number.parseInt(component, 10);
  return !Number.isNaN(n) && n.toString() === component ? n : null;
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
