import { type Matcher, noMatch } from './router.js';

type Match<TMatcher extends Matcher<unknown>> =
  TMatcher extends Matcher<infer T> ? T : never;

export const decoded: Matcher<string> = (component: string): string => {
  return decodeURIComponent(component);
};

export const encoded: Matcher<string> = (component: string): string => {
  return component;
};

export const integer: Matcher<number> = (
  component: string,
): number | typeof noMatch => {
  const n = Number.parseInt(component, 10);
  return n.toString() === component ? n : noMatch;
};

export function choice<const TMatchers extends Matcher<unknown>[]>(
  ...matchers: TMatchers
): Matcher<Match<TMatchers[number]>> {
  return (component, url) => {
    for (const matcher of matchers) {
      const result = matcher(component, url);
      if (result !== noMatch) {
        return result as Match<TMatchers[number]>;
      }
    }
    return noMatch;
  };
}

export function keyword<const T extends string>(s: T): Matcher<T> {
  return (component) => (component === s ? s : noMatch);
}

export function regexp(pattern: RegExp): Matcher<RegExpMatchArray> {
  return (component) => component.match(pattern) ?? noMatch;
}

export function select<TSource, TResult>(
  matcher: Matcher<TSource>,
  selector: (value: TSource) => TResult,
): Matcher<TResult> {
  return (component, url) => {
    const source = matcher(component, url);
    return source !== noMatch ? selector(source) : noMatch;
  };
}
