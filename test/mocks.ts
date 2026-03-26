/// <reference path="../typings/scheduler.d.ts" />

import { vi } from 'vitest';
import type { HostAdapter, RequestCallbackOptions } from '@/adapter.js';
import {
  type Binding,
  type CommitPhase,
  type Coroutine,
  type DirectiveContext,
  type DirectiveType,
  type Effect,
  EffectQueue,
  type Lanes,
  type Primitive,
  type RenderFrame,
  Scope,
  type Session,
  type SessionEvent,
  type SessionObserver,
  type TemplateMode,
} from '@/core.js';
import { SyncLane } from '@/lane.js';
import { Runtime, type RuntimeOptions } from '@/runtime.js';

export class MockAdapter implements HostAdapter {
  readonly defaultLanes: Lanes;

  constructor(defaultLanes: Lanes = SyncLane) {
    this.defaultLanes = defaultLanes;
  }

  flushEffects(effects: EffectQueue, _phase: CommitPhase): void {
    effects.flush();
  }

  getDefaultLanes(): Lanes {
    return this.defaultLanes;
  }

  getUpdatePriority(): TaskPriority {
    return 'user-visible';
  }

  requestRenderer(_scope: Scope): unknown {
    return {};
  }

  requestCallback<T>(
    callback: () => T | PromiseLike<T>,
    options: RequestCallbackOptions = {},
  ): Promise<T> {
    let bssePromise: Promise<T | void>;

    switch (options?.priority) {
      case 'user-visible':
        bssePromise = new Promise((resolve) => setTimeout(resolve));
        break;
      case 'background':
        bssePromise = new Promise((resolve) => setTimeout(resolve, 1));
        break;
      default:
        bssePromise = Promise.resolve();
        break;
    }

    const promise = bssePromise.then(() => {
      options.signal?.throwIfAborted();
      return callback();
    });

    return options.signal !== undefined
      ? Promise.race([promise, waitForAbort<T>(options.signal)])
      : promise;
  }

  resolvePrimitive(_value: unknown, _part: unknown): Primitive<unknown> {
    return MockPrimitive;
  }

  resolveTemplate(
    _strings: readonly string[],
    _exprs: readonly unknown[],
    _mode: TemplateMode,
    _placeholder: string,
  ): DirectiveType<readonly unknown[]> {
    return new MockType();
  }

  startViewTransition(callback: () => void | Promise<void>): Promise<void> {
    return Promise.resolve().then(callback);
  }

  yieldToMain(): Promise<void> {
    return Promise.resolve();
  }
}

export class MockBinding<TValue> implements Binding<TValue> {
  readonly type: DirectiveType<TValue>;

  value: TValue;

  readonly part: unknown;

  currentValue: TValue | null = null;

  constructor(type: DirectiveType<TValue>, value: TValue, part: unknown) {
    this.type = type;
    this.value = value;
    this.part = part;
  }

  shouldUpdate(value: TValue): boolean {
    return !Object.is(value, this.currentValue);
  }

  attach(_session: Session): void {}

  detach(_session: Session): void {}

  commit(): void {
    this.currentValue = this.value;
  }

  rollback(): void {
    this.currentValue = null;
  }
}

export class MockCoroutine implements Coroutine {
  name: string;

  scope: Scope;

  pendingLanes: Lanes;

  callback: (this: Coroutine, session: Session) => void;

  constructor(
    name: string = MockCoroutine.name,
    scope: Scope = Scope.Root(),
    pendingLanes: Lanes = -1,
    callback: (this: Coroutine, session: Session) => void = () => {},
  ) {
    this.name = name;
    this.scope = scope;
    this.pendingLanes = pendingLanes;
    this.callback = callback;
  }

  start(session: Session): void {
    session.frame.coroutines.push(this);
  }

  resume(session: Session): void {
    this.callback(session);
  }
}

export abstract class MockPrimitive {
  static ensureValue<T>(_value: unknown): asserts _value is T {}
  static resolveBinding<TValue>(
    value: TValue,
    part: unknown,
    _context: DirectiveContext,
  ): MockBinding<TValue> {
    return new MockBinding<TValue>(this, value, part);
  }
}

export class MockObserver implements SessionObserver {
  events: SessionEvent[] = [];

  onSessionEvent(event: SessionEvent): void {
    this.events.push(event);
  }

  flushEvents(): SessionEvent[] {
    return this.events.splice(0);
  }
}

export class MockType<TValue> implements DirectiveType<TValue> {
  readonly name: string;

  constructor(name: string = MockType.name) {
    this.name = name;
  }

  resolveBinding(
    value: TValue,
    part: unknown,
    _context: DirectiveContext,
  ): Binding<TValue> {
    return new MockBinding(this, value, part);
  }
}

export function createEffect(callback: () => void = () => {}): Effect {
  return { commit: vi.fn(callback) };
}

export function createEffectQueue(...effects: Effect[]): EffectQueue {
  return effects.reduce((effects, effect) => {
    effects.push(effect, 0);
    return effects;
  }, new EffectQueue());
}

export function createRenderFrame(id: number, lanes: Lanes): RenderFrame {
  return {
    id,
    lanes,
    coroutines: [],
    mutationEffects: new EffectQueue(),
    layoutEffects: new EffectQueue(),
    passiveEffects: new EffectQueue(),
  };
}

export function createMockRuntime(
  defaultLanes?: Lanes,
  options: RuntimeOptions = {},
): Runtime {
  return new Runtime(new MockAdapter(defaultLanes), options);
}

function waitForAbort<T>(signal: AbortSignal): Promise<T> {
  return new Promise<T>((_resolve, reject) => {
    signal.addEventListener('abort', () => {
      reject(signal.reason);
    });
  });
}
