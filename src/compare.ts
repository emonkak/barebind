export function dependenciesAreChanged(
  oldDependencies: unknown[] | undefined,
  newDependencies: unknown[] | undefined,
): boolean {
  if (
    oldDependencies === undefined ||
    newDependencies === undefined ||
    oldDependencies.length !== newDependencies.length
  ) {
    return true;
  }

  for (let i = 0, l = oldDependencies.length; i < l; i++) {
    if (!Object.is(oldDependencies[i], newDependencies[i])) {
      return true;
    }
  }

  return false;
}

export function shallowEqual(firstProps: {}, secondProps: {}): boolean {
  if (firstProps === secondProps) {
    return true;
  }

  const firstKeys = Object.keys(firstProps) as (keyof typeof firstProps)[];
  const secondKeys = Object.keys(secondProps) as (keyof typeof secondProps)[];

  if (firstKeys.length !== secondKeys.length) {
    return false;
  }

  for (let i = 0, l = firstKeys.length; i < l; i++) {
    const key = firstKeys[i]!;
    if (
      !Object.hasOwn(secondProps, key) ||
      !Object.is(firstProps[key], secondProps[key])
    ) {
      return false;
    }
  }

  return true;
}
