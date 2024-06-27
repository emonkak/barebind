export function combination(n: number, r: number): number {
  return factorial(n) / (factorial(r) * factorial(n - r));
}

export function factorial(n: number): number {
  let result = 1;
  for (let i = n; i > 1; i--) {
    result *= i;
  }
  return result;
}

export function* allCombinations<T>(source: T[]): Generator<T[]> {
  for (let i = 1; i <= source.length; i++) {
    yield* combinations(source, i);
  }
}

export function* combinations<T>(source: T[], r: number): Generator<T[]> {
  if (r === 0) {
    yield [];
  } else if (r === 1) {
    for (const x of source) {
      yield [x];
    }
  } else {
    for (let i = 0, l = source.length - r; i <= l; i++) {
      for (const ys of combinations(source.slice(i + 1), r - 1)) {
        yield ([source[i]!] as T[]).concat(ys);
      }
    }
  }
}

export function* permutations<T>(
  source: T[],
  r: number = source.length,
): Generator<T[]> {
  if (r === 0) {
    yield [];
  } else if (r === 1) {
    yield source;
  } else {
    for (let i = 0, l = r; i < l; i++) {
      for (const rest of permutations(
        source.slice(0, i).concat(source.slice(i + 1)),
        r - 1,
      )) {
        yield ([source[i]!] as T[]).concat(rest);
      }
    }
  }
}
