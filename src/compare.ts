export function dependenciesAreChanged(
  oldDependencies: ArrayLike<unknown> | undefined,
  newDependencies: ArrayLike<unknown> | undefined,
): boolean {
  return (
    oldDependencies === undefined ||
    newDependencies === undefined ||
    !sequentialEqual(oldDependencies, newDependencies)
  );
}

export function sequentialEqual<T>(
  first: ArrayLike<T>,
  second: ArrayLike<T>,
): boolean {
  if (first === second) {
    return true;
  }

  if (first.length !== second.length) {
    return false;
  }

  for (let i = 0, l = first.length; i < l; i++) {
    if (!Object.is(first[i], second[i])) {
      return false;
    }
  }

  return true;
}

export function shallowEqual<T extends {}>(first: T, second: T): boolean {
  if (first === second) {
    return true;
  }

  const firstKeys = Object.keys(first) as (keyof T)[];
  const secondKeys = Object.keys(second) as (keyof T)[];

  if (firstKeys.length !== secondKeys.length) {
    return false;
  }

  for (let i = 0, l = firstKeys.length; i < l; i++) {
    const key = firstKeys[i]!;
    if (!Object.hasOwn(second, key) || !Object.is(first[key], second[key])) {
      return false;
    }
  }

  return true;
}
