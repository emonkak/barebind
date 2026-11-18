export const hasOwn = Object.hasOwn;
export const is = Object.is;
export const keys = Object.keys;

export function areDependenciesChanged(
  oldDeps: readonly unknown[] | null | undefined,
  newDeps: readonly unknown[] | null | undefined,
): boolean {
  return (
    oldDeps == null || newDeps == null || !sequentialEqual(oldDeps, newDeps)
  );
}

export function isObject<T>(value: T): value is T & object {
  return typeof value === 'object' && value !== null;
}

export function sequentialEqual<T>(
  xs: ArrayLike<T>,
  ys: ArrayLike<T>,
  equals: (x: T, y: T) => boolean = is,
): boolean {
  if (xs.length !== ys.length) {
    return false;
  }

  for (let i = 0, l = xs.length; i < l; i++) {
    if (!equals(xs[i]!, ys[i]!)) {
      return false;
    }
  }

  return true;
}

export function shallowEqual<T extends object>(
  xs: T,
  ys: T,
  equals: <K extends keyof T>(x: T[K], y: T[K]) => boolean = is,
): boolean {
  const ks = keys(xs);

  if (ks.length !== keys(ys).length) {
    return false;
  }

  for (let i = 0, l = ks.length; i < l; i++) {
    const k = ks[i] as keyof T;
    if (!hasOwn(ys, k) || !equals(xs[k]!, ys[k]!)) {
      return false;
    }
  }

  return true;
}
