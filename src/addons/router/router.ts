export interface Route<
  TResult,
  TPatterns extends Pattern[],
  TInheritCaptures extends unknown[],
> {
  patterns: TPatterns;
  resolver: Resolver<
    TResult,
    [...TInheritCaptures, ...CollectCaptures<TPatterns>]
  > | null;
  childRoutes: Route<
    TResult,
    Pattern[],
    [...TInheritCaptures, ...CollectCaptures<TPatterns>]
  >[];
}

export type Pattern = string | Matcher<unknown>;

export type Matcher<T> = (component: string, url: string) => T | undefined;

export type Resolver<TResult, TCaptures extends unknown[]> = (
  captures: TCaptures,
  url: string,
) => TResult;

type ApplyPattern<TPattern> = TPattern extends Matcher<infer T> ? [T] : [];

type CollectCaptures<TPatterns> = TPatterns extends [infer Head, ...infer Tail]
  ? [...ApplyPattern<Head>, ...CollectCaptures<Tail>]
  : TPatterns extends []
    ? []
    : unknown[];

export class Router<TResult> {
  private readonly _routes: Route<TResult, Pattern[], []>[] = [];

  constructor(routes: Route<TResult, Pattern[], []>[]) {
    this._routes = routes;
  }

  match(url: string): TResult | undefined {
    const components = stripLeadingSlash(url).split('/');
    const collectedCaptures: unknown[] = [];

    let routes = this._routes;
    let routeIndex = 0;
    let componentIndex = 0;

    while (routeIndex < routes.length) {
      const { patterns, childRoutes, resolver } = routes[routeIndex]!;
      const captures = collectCaptures(
        patterns,
        components,
        componentIndex,
        url,
      );

      if (captures !== null) {
        collectedCaptures.push(...captures);
        if (components.length === componentIndex + patterns.length) {
          return resolver?.(collectedCaptures, url);
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

    return undefined;
  }
}

export function route<
  TResult,
  const TPatterns extends Pattern[],
  const TInheritCaptures extends unknown[],
>(
  patterns: TPatterns,
  resolver: Route<TResult, TPatterns, TInheritCaptures>['resolver'],
  childRoutes: Route<TResult, TPatterns, TInheritCaptures>['childRoutes'] = [],
): Route<TResult, TPatterns, TInheritCaptures> {
  return {
    patterns,
    resolver,
    childRoutes,
  };
}

function collectCaptures<TPatterns extends Pattern[]>(
  patterns: TPatterns,
  components: string[],
  startIndex: number,
  url: string,
): CollectCaptures<TPatterns> | null {
  const endIndex = startIndex + patterns.length;
  if (endIndex > components.length) {
    return null;
  }
  const captures: unknown[] = [];
  for (let i = startIndex; i < endIndex; i++) {
    const pattern = patterns[i - startIndex]!;
    const component = components[i]!;
    if (typeof pattern === 'string') {
      if (component !== pattern) {
        return null;
      }
    } else {
      const capture = pattern(component, url);
      if (capture === undefined) {
        return null;
      }
      captures.push(capture);
    }
  }
  return captures as CollectCaptures<TPatterns>;
}

function stripLeadingSlash(path: string): string {
  return path[0] === '/' ? path.slice(1) : path;
}
