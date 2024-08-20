import type { RelativeURL } from './location.js';

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

export type Pattern = string | Matcher<unknown>;

export type Matcher<T> = (
  component: string,
  url: RelativeURL,
  state: unknown,
) => T | null;

export type Handler<TArgs extends any[], TResult> = (
  args: TArgs,
  url: RelativeURL,
  state: unknown,
) => TResult;

type ExtractArgs<TPatterns> = TPatterns extends []
  ? []
  : TPatterns extends [infer THead, ...infer TTail]
    ? [...Match<THead>, ...ExtractArgs<TTail>]
    : unknown[];

type Match<TPattern> = TPattern extends string
  ? []
  : TPattern extends Matcher<infer T>
    ? [T]
    : [];

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

export function integer(component: string): number | null {
  const n = Number.parseInt(component, 10);
  return n.toString() === component ? n : null;
}

export function regexp(pattern: RegExp): Matcher<string> {
  return (component: string) => component.match(pattern)?.[0] ?? null;
}

export function route<
  TResult,
  const TPatterns extends Pattern[] = Pattern[],
  const TInheritArgs extends unknown[] = [],
>(
  patterns: TPatterns,
  handler: Route<TResult, TPatterns, TInheritArgs>['handler'],
  childRoutes: Route<TResult, TPatterns, TInheritArgs>['childRoutes'] = [],
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
    } else {
      const value = pattern(component, url, state);
      if (value === null) {
        return null;
      }
      args.push(value);
    }
  }
  return args as ExtractArgs<TPatterns>;
}
