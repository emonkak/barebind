import {
  type Hook,
  HookType,
  Lanes,
  type ScheduleOptions,
  type UpdateContext,
  type UpdateFrame,
} from '@/internal.js';
import { RenderSession } from '@/render-session.js';
import { Runtime, type RuntimeOptions } from '@/runtime.js';
import { MockBackend, MockCoroutine } from './mocks.js';

export class RenderHelper {
  readonly runtime;

  coroutine: MockCoroutine<any> = new MockCoroutine(() => {});

  hooks: Hook[] = [];

  constructor(runtime: Runtime = createRuntime()) {
    this.runtime = runtime;
  }

  finalizeHooks(): void {
    for (let i = this.hooks.length - 1; i >= 0; i--) {
      const hook = this.hooks[i]!;
      if (
        hook.type === HookType.Effect ||
        hook.type === HookType.LayoutEffect ||
        hook.type === HookType.InsertionEffect
      ) {
        hook.cleanup?.();
        hook.cleanup = undefined;
      }
    }
    this.hooks = [];
  }

  startSession<T>(
    callback: (context: RenderSession) => T,
    options: ScheduleOptions = {},
  ): T {
    this.coroutine.callback = (context) => {
      const session = new RenderSession(
        this.hooks,
        this.coroutine,
        context.frame,
        context.scope,
        this.runtime,
      );
      const result = callback(session);
      session.finalize();
      return result;
    };
    this.coroutine.pendingLanes = Lanes.AllLanes;
    this.runtime
      .scheduleUpdate(this.coroutine, {
        immediate: true,
        silent: true,
        ...options,
      })
      .finished.catch(() => {});
    this.runtime.flushSync();
    if (this.coroutine.thrownError !== undefined) {
      throw this.coroutine.thrownError;
    }
    return this.coroutine.returnValue!;
  }

  async waitForAll(): Promise<number> {
    return waitForAll(this.runtime);
  }
}

export class UpdateHelper {
  readonly runtime;

  constructor(runtime: Runtime = createRuntime()) {
    this.runtime = runtime;
  }

  startSession<T>(
    callback: (context: UpdateContext) => T,
    options: ScheduleOptions = {},
  ): T {
    const coroutine = new MockCoroutine(callback);
    this.runtime
      .scheduleUpdate(coroutine, { immediate: true, silent: true, ...options })
      .finished.catch(() => {});
    this.runtime.flushSync();
    if (coroutine.thrownError !== undefined) {
      throw coroutine.thrownError;
    }
    return coroutine.returnValue!;
  }

  async waitForAll(): Promise<number> {
    return waitForAll(this.runtime);
  }
}

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

export function createRuntime(options?: RuntimeOptions): Runtime {
  return new Runtime(new MockBackend(), options);
}

export function createUpdateFrame(id: number, lanes: Lanes): UpdateFrame {
  return {
    id,
    lanes,
    pendingCoroutines: [],
    mutationEffects: [],
    layoutEffects: [],
    passiveEffects: [],
  };
}

export function factorial(n: number): number {
  let result = 1;
  for (let i = n; i > 1; i--) {
    result *= i;
  }
  return result;
}

export function getPromiseState(
  promise: Promise<unknown>,
): Promise<'pending' | 'fulfilled' | 'rejected'> {
  const tag = {};
  return Promise.race([promise, tag]).then(
    (value) => (value === tag ? 'pending' : 'fulfilled'),
    () => 'rejected',
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

export function templateLiteral(
  strings: TemplateStringsArray,
  ...values: readonly unknown[]
): { strings: TemplateStringsArray; values: readonly unknown[] } {
  return { strings, values };
}

async function waitForAll(runtime: Runtime): Promise<number> {
  const promises = Array.from(
    runtime.getPendingTasks(),
    (pendingTask) => pendingTask.continuation.promise,
  );
  return (await Promise.allSettled(promises)).length;
}
