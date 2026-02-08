export type PromiseState<T> =
  | { status: 'pending' }
  | { status: 'fulfilled'; value: T }
  | { status: 'rejected'; reason: unknown };

export function* allCombinations<T>(xs: T[]): Generator<T[]> {
  for (let i = 1; i <= xs.length; i++) {
    yield* combinations(xs, i);
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

export function createElement<const TName extends keyof HTMLElementTagNameMap>(
  name: TName,
  attributes: { [key: string]: string } = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[TName] {
  const element = document.createElement(name);
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

export function createElementNS(
  namespaceURI: string,
  name: string,
  attributes: { [key: string]: string } = {},
  ...children: (Node | string)[]
): Element {
  const element = document.createElementNS(namespaceURI, name);
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

export function inspectPromise<T>(
  promise: PromiseLike<T>,
): Promise<PromiseState<T>> {
  const pending = {};
  return Promise.race([promise, pending]).then(
    (value) =>
      value === pending
        ? { status: 'pending' }
        : ({ status: 'fulfilled', value } as PromiseState<T>),
    (reason) => ({ status: 'rejected', reason }),
  );
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

export function serializeNode(node: Node): string {
  const wrapper = document.createElement('div');
  wrapper.appendChild(node.cloneNode(true));
  return wrapper.innerHTML;
}

export function stripComments<T extends Node>(node: T): T {
  const iterator = document.createNodeIterator(
    node.cloneNode(true),
    NodeFilter.SHOW_COMMENT,
  );

  while (true) {
    const nextNode = iterator.nextNode() as Comment | null;

    if (nextNode === null) {
      break;
    }

    nextNode.remove();
  }

  return iterator.root as T;
}

export function templateLiteral<TValues extends readonly unknown[]>(
  strings: TemplateStringsArray,
  ...values: TValues
): [TemplateStringsArray, ...TValues] {
  return [strings, ...values];
}

export async function waitForMicrotasks(times: number = 1): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

export function waitForSignal<T>(signal: AbortSignal): Promise<T> {
  return new Promise<T>((_resolve, reject) => {
    signal.addEventListener('abort', () => {
      reject(signal.reason);
    });
  });
}

export function waitForTimeout(timeout: number = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

export function waitUntil(priority: TaskPriority): Promise<void> {
  return new Promise((resolve) => scheduler.postTask(resolve, { priority }));
}
