import type { Matcher } from './router.js';

type Match<TMatcher extends Matcher<unknown>> =
  TMatcher extends Matcher<infer T> ? T : never;

export function choice<const TMatchers extends Matcher<unknown>[]>(
  ...matchers: TMatchers
): Matcher<Match<TMatchers[number]>> {
  return (component, url) => {
    for (const matcher of matchers) {
      const result = matcher(component, url);
      if (result !== undefined) {
        return result as Match<TMatchers[number]>;
      }
    }
    return undefined;
  };
}

export function decoded(component: string): string {
  return decodeURIComponent(component);
}

export function encoded(component: string): string {
  return component;
}

export function integer(component: string): number | undefined {
  const n = Number.parseInt(component, 10);
  return n.toString() === component ? n : undefined;
}

export function keyword<const T extends string>(s: T): Matcher<T> {
  return (component) => (component === s ? s : undefined);
}

export function regexp(pattern: RegExp): Matcher<RegExpMatchArray> {
  return (component) => component.match(pattern) ?? undefined;
}

export function select<TSource, TResult>(
  matcher: Matcher<TSource>,
  selector: (value: TSource) => TResult,
): Matcher<TResult> {
  return (component, url) => {
    const source = matcher(component, url);
    return source !== undefined ? selector(source) : undefined;
  };
}
