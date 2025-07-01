import { type Hook, HookType } from '../src/hook.js';

export function* allCombinations<T>(xs: T[]): Generator<T[]> {
  for (let i = 1; i <= xs.length; i++) {
    yield* combinations(xs, i);
  }
}

export function cleanupHooks(hooks: Hook[]): void {
  for (let i = hooks.length - 1; i >= 0; i--) {
    const hook = hooks[i]!;
    if (
      hook.type === HookType.Effect ||
      hook.type === HookType.LayoutEffect ||
      hook.type === HookType.InsertionEffect
    ) {
      hook.cleanup?.();
      hook.cleanup = undefined;
    }
  }
}

export function combination(n: number, r: number): number {
  return factorial(n) / (factorial(r) * factorial(n - r));
}

export function* combinations<T>(xs: T[], r: number): Generator<T[]> {
  if (r === 0) {
    yield [];
  } else if (r === 1) {
    for (const x of xs) {
      yield [x];
    }
  } else {
    for (let i = 0, l = xs.length - r; i <= l; i++) {
      for (const ys of combinations(xs.slice(i + 1), r - 1)) {
        yield ([xs[i]!] as T[]).concat(ys);
      }
    }
  }
}

export function createElement<const T extends keyof HTMLElementTagNameMap>(
  tagName: T,
  attributes: { [key: string]: string } = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[T] {
  const element = document.createElement(tagName);
  for (const key in attributes) {
    element.setAttribute(key, attributes[key]!);
  }
  for (const child of children) {
    element.appendChild(
      child instanceof Node ? child : document.createTextNode(child),
    );
  }
  return element;
}

export function factorial(n: number): number {
  let result = 1;
  for (let i = n; i > 1; i--) {
    result *= i;
  }
  return result;
}

export function* permutations<T>(
  xs: T[],
  r: number = xs.length,
): Generator<T[]> {
  if (r === 0) {
    yield [];
  } else if (r === 1) {
    yield xs;
  } else {
    for (let i = 0, l = r; i < l; i++) {
      for (const ys of permutations(
        xs.slice(0, i).concat(xs.slice(i + 1)),
        r - 1,
      )) {
        yield ([xs[i]!] as T[]).concat(ys);
      }
    }
  }
}
