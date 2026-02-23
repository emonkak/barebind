import type { RelativeURL } from './relative-url.js';

export const noMatch: unique symbol = Symbol('noMatch');

export interface Route<
  TResult,
  TArgs extends unknown[],
  TPatterns extends Pattern[],
  TInheritCaptures extends unknown[],
> {
  patterns: TPatterns;
  resolver: Resolver<
    TResult,
    TArgs,
    [...TInheritCaptures, ...CollectCaptures<TPatterns>]
  > | null;
  childRoutes: Route<
    TResult,
    TArgs,
    Pattern[],
    [...TInheritCaptures, ...CollectCaptures<TPatterns>]
  >[];
}

export type Pattern = string | Matcher<unknown>;

export type Matcher<T> = (
  component: string,
  url: RelativeURL,
) => T | typeof noMatch;

export type Resolver<
  TResult,
  TArgs extends unknown[],
  TCaptures extends unknown[],
> = (captures: TCaptures, url: RelativeURL, ...args: TArgs) => TResult;

type CollectCaptures<TPatterns> = TPatterns extends []
  ? []
  : TPatterns extends [infer Head, ...infer Tail]
    ? [...Match<Head>, ...CollectCaptures<Tail>]
    : unknown[];

type Match<TPattern> = TPattern extends Matcher<infer T> ? [T] : [];

export class Router<TResult, TArgs extends unknown[] = []> {
  private readonly _routes: Route<TResult, TArgs, Pattern[], []>[] = [];

  constructor(routes: Route<TResult, TArgs, Pattern[], []>[]) {
    this._routes = routes;
  }

  match(url: RelativeURL, ...args: TArgs): TResult | null {
    const components = trimLeadingSlash(url.pathname).split('/');
    const collectedCaptures: unknown[] = [];

    let routes = this._routes;
    let routeIndex = 0;
    let componentIndex = 0;

    while (routeIndex < routes.length) {
      const { patterns, childRoutes, resolver } = routes[routeIndex]!;
      const captures = collectCaptures(
        patterns,
        components.slice(componentIndex, componentIndex + patterns.length),
        url,
      );

      if (captures !== null) {
        collectedCaptures.push(...captures);
        if (components.length === componentIndex + patterns.length) {
          return resolver?.(collectedCaptures, url, ...args) ?? null;
        }
        if (childRoutes.length > 0) {
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

export function integer(component: string): number | typeof noMatch {
  const n = Number.parseInt(component, 10);
  return n.toString() === component ? n : noMatch;
}

export function regexp(pattern: RegExp): Matcher<string> {
  return (component: string) => component.match(pattern)?.[0] ?? noMatch;
}

export function route<
  TResult,
  const TArgs extends unknown[],
  const TPatterns extends Pattern[],
  const TInheritCaptures extends unknown[],
>(
  patterns: TPatterns,
  resolver: Route<TResult, TArgs, TPatterns, TInheritCaptures>['resolver'],
  childRoutes: Route<
    TResult,
    TArgs,
    TPatterns,
    TInheritCaptures
  >['childRoutes'] = [],
): Route<TResult, TArgs, TPatterns, TInheritCaptures> {
  return {
    patterns,
    resolver,
    childRoutes,
  };
}

function collectCaptures<TPatterns extends Pattern[]>(
  patterns: TPatterns,
  components: string[],
  url: RelativeURL,
): CollectCaptures<TPatterns> | null {
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
      if (capture === noMatch) {
        return null;
      }
      captures.push(capture);
    }
  }
  return captures as CollectCaptures<TPatterns>;
}

function trimLeadingSlash(path: string): string {
  return path[0] === '/' ? path.slice(1) : path;
}
