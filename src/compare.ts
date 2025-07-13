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
  equals: (x: T[keyof T], y: T[keyof T]) => boolean = Object.is,
): boolean {
  if (xs === ys) {
    return true;
  }

  const firstKeys = Object.keys(xs);
  const secondKeys = Object.keys(ys);

  if (firstKeys.length !== secondKeys.length) {
    return false;
  }

  for (let i = 0, l = firstKeys.length; i < l; i++) {
    const key = firstKeys[i]! as keyof T;
    if (!Object.hasOwn(ys, key) || !equals(xs[key]!, ys[key]!)) {
      return false;
    }
  }

  return true;
}
