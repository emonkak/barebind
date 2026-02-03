import type { RelativeURL } from './relative-url.js';

export interface Route<
  TResult,
  TContext,
  TPatterns extends Pattern[] = Pattern[],
  TInheritCaptures extends unknown[] = [],
> {
  patterns: TPatterns;
  resolver: Resolver<
    [...TInheritCaptures, ...ExtractCaptures<TPatterns>],
    TResult,
    TContext
  > | null;
  childRoutes: Route<
    TResult,
    TContext,
    Pattern[],
    [...TInheritCaptures, ...ExtractCaptures<TPatterns>]
  >[];
}

export type Pattern = string | Matcher<unknown>;

export type Matcher<T> = (component: string, url: RelativeURL) => T | null;

export type Resolver<TCaptures extends unknown[], TResult, TContext> = (
  captures: TCaptures,
  url: RelativeURL,
  context: TContext,
) => TResult;

type ExtractCaptures<TPatterns> = TPatterns extends []
  ? []
  : TPatterns extends [infer THead, ...infer TTail]
    ? [...Match<THead>, ...ExtractCaptures<TTail>]
    : unknown[];

type Match<TPattern> = TPattern extends string
  ? []
  : TPattern extends Matcher<infer T>
    ? [T]
    : [];

export class Router<TResult, TContext> {
  private readonly _routes: Route<TResult, TContext>[] = [];

  constructor(routes: Route<TResult, TContext>[]) {
    this._routes = routes;
  }

  match(url: RelativeURL, context: TContext): TResult | null {
    const path = url.pathname;
    const pathWithoutInitialSlash = path[0] === '/' ? path.slice(1) : path;
    const components = pathWithoutInitialSlash.split('/');

    let routes = this._routes;
    let routeIndex = 0;
    let componentIndex = 0;
    let allCaptures: unknown[] = [];

    while (routeIndex < routes.length) {
      const { patterns, childRoutes, resolver } = routes[routeIndex]!;
      const captures = extractCaptures(
        patterns,
        components.slice(componentIndex, componentIndex + patterns.length),
        url,
      );

      if (captures !== null) {
        if (components.length === componentIndex + patterns.length) {
          return resolver !== null
            ? resolver(allCaptures.concat(captures), url, context)
            : null;
        }
        if (childRoutes.length > 0) {
          allCaptures = allCaptures.concat(captures);
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

export function decoded(component: string): string {
  return decodeURIComponent(component);
}

export function encoded(component: string): string {
  return component;
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
  TContext = unknown,
  const TPatterns extends Pattern[] = Pattern[],
  const TInheritCaptures extends unknown[] = [],
>(
  patterns: TPatterns,
  resolver: Route<TResult, TContext, TPatterns, TInheritCaptures>['resolver'],
  childRoutes: Route<
    TResult,
    TContext,
    TPatterns,
    TInheritCaptures
  >['childRoutes'] = [],
): Route<TResult, TContext, TPatterns, TInheritCaptures> {
  return {
    patterns,
    resolver,
    childRoutes,
  };
}

function extractCaptures<TPatterns extends Pattern[]>(
  patterns: TPatterns,
  components: string[],
  url: RelativeURL,
): ExtractCaptures<TPatterns> | null {
  if (patterns.length !== components.length) {
    return null;
  }
  const captures: unknown[] = [];
  for (let i = 0, l = patterns.length; i < l; i++) {
    const pattern = patterns[i]!;
    const component = components[i]!;
    if (typeof pattern === 'string') {
      if (pattern !== component) {
        return null;
      }
    } else {
      const capture = pattern(component, url);
      if (capture === null) {
        return null;
      }
      captures.push(capture);
    }
  }
  return captures as ExtractCaptures<TPatterns>;
}
