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
  | ((component: string, url: URL, state: unknown) => any);

export type Handler<TArgs extends any[], TResult> = (
  args: TArgs,
  url: URL,
  state: unknown,
) => TResult;

export interface LocationState {
  url: URL;
  state: unknown;
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
          url: URL,
          stae: unknown,
        ) => NonNullable<infer TResult> | null
      ? [TResult]
      : never;

export class Router<TResult> {
  private readonly _routes: Route<TResult>[] = [];

  constructor(routes: Route<TResult>[]) {
    this._routes = routes;
  }

  dispatch(url: URL, state: unknown = null): TResult | null {
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

export function browserLocation(context: RenderContext): LocationState {
  const [locationState, setLocationState] = context.useState(() => ({
    url: new URL(location.href),
    state: history.state,
  }));
  context.useEffect(() => {
    const listener = (event: PopStateEvent) => {
      setLocationState({
        url: new URL(location.href),
        state: event.state,
      });
    };
    addEventListener('popstate', listener);
    return () => {
      removeEventListener('popstate', listener);
    };
  }, []);
  return locationState;
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
  url: URL,
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
