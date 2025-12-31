import {
  type Coroutine,
  type Hook,
  HookType,
  Lanes,
  type RenderFrame,
  Scope,
  type UpdateOptions,
  type UpdateSession,
} from '@/internal.js';
import { RenderSession } from '@/render-session.js';
import { Runtime, type RuntimeOptions } from '@/runtime.js';
import { MockBackend } from './mocks.js';

interface TestRenderOptions extends UpdateOptions {
  scope?: Scope;
  coroutine?: Coroutine;
}

interface TestUpdateOptions extends UpdateOptions {
  scope?: Scope;
}

export class TestRenderer {
  readonly runtime: Runtime;

  hooks: Hook[] = [];

  constructor(runtime: Runtime = createRuntime()) {
    this.runtime = runtime;
  }

  finalizeHooks(): void {
    for (let i = this.hooks.length - 1; i >= 0; i--) {
      const hook = this.hooks[i]!;
      if (
        hook.type === HookType.PassiveEffect ||
        hook.type === HookType.LayoutEffect ||
        hook.type === HookType.InsertionEffect
      ) {
        hook.cleanup?.();
        hook.cleanup = undefined;
      }
    }
    this.hooks = [];
  }

  startRender<T>(
    callback: (session: RenderSession) => T,
    options: TestRenderOptions = {},
  ): T {
    let returnValue: T;
    let thrownError: unknown;

    const state = {
      hooks: this.hooks,
      pendingLanes: Lanes.AllLanes,
    };
    const coroutine = {
      get pendingLanes(): Lanes {
        return state.pendingLanes;
      },
      scope: options.scope ?? new Scope(),
      resume({ frame, rootScope, scope, context }: UpdateSession): void {
        const session = new RenderSession(
          state,
          options.coroutine ?? coroutine,
          frame,
          scope,
          context,
        );
        rootScope.addErrorHandler((error) => {
          thrownError = error;
        });
        returnValue = callback(session);
        session.finalize();
        state.pendingLanes &= ~frame.lanes;
      },
    };

    this.runtime.scheduleUpdate(coroutine, {
      flush: false,
      immediate: true,
      ...options,
    });

    this.runtime.flushSync();

    if (thrownError !== undefined) {
      throw thrownError;
    }

    return returnValue!;
  }
}

export class TestUpdater {
  readonly runtime;

  constructor(runtime: Runtime = createRuntime()) {
    this.runtime = runtime;
  }

  startUpdate<T>(
    callback: (session: UpdateSession) => T,
    options: TestUpdateOptions = {},
  ): T {
    let returnValue: T;
    let thrownError: unknown;

    const coroutine = {
      pendingLanes: Lanes.AllLanes,
      scope: options.scope ?? new Scope(),
      resume(session: UpdateSession): void {
        session.rootScope.addErrorHandler((error) => {
          thrownError = error;
        });
        returnValue = callback(session);
        this.pendingLanes &= ~session.frame.lanes;
      },
    };

    this.runtime.scheduleUpdate(coroutine, {
      flush: false,
      immediate: true,
      ...options,
    });

    this.runtime.flushSync();

    if (thrownError !== undefined) {
      throw thrownError;
    }

    return returnValue!;
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

export function createRenderFrame(id: number, lanes: Lanes): RenderFrame {
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
