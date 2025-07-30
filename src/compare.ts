export function sequentialEqual<T>(
  xs: ArrayLike<T>,
  ys: ArrayLike<T>,
  equals: (x: T, y: T) => boolean = Object.is,
): boolean {
  if (xs === ys) {
    return true;
  }

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

export function shallowEqual<T extends {}>(
  xs: T,
  ys: T,
  equals: <K extends keyof T>(x: T[K], y: T[K]) => boolean = Object.is,
): boolean {
  if (xs === ys) {
    return true;
  }

  const ks1 = Object.keys(xs);
  const ks2 = Object.keys(ys);

  if (ks1.length !== ks2.length) {
    return false;
  }

  for (let i = 0, l = ks1.length; i < l; i++) {
    const k = ks1[i]! as keyof T;
    if (!Object.hasOwn(ys, k) || !equals(xs[k]!, ys[k]!)) {
      return false;
    }
  }

  return true;
}
