/// <reference path="../typings/scheduler.d.ts" />

import { vi } from 'vitest';
import {
  type Backend,
  type Binding,
  type CommitPhase,
  type Coroutine,
  type DirectiveContext,
  type DirectiveType,
  type Effect,
  EffectQueue,
  type Lanes,
  PART_TYPE_ATTRIBUTE,
  PART_TYPE_CHILD_NODE,
  PART_TYPE_ELEMENT,
  PART_TYPE_EVENT,
  PART_TYPE_LIVE,
  PART_TYPE_PROPERTY,
  PART_TYPE_TEXT,
  type Part,
  type Primitive,
  type RenderFrame,
  type RequestCallbackOptions,
  Scope,
  type Session,
  type SessionEvent,
  type SessionObserver,
  type TemplateMode,
} from '@/core.js';
import { SyncLane } from '@/lane.js';
import { Runtime, type RuntimeOptions } from '@/runtime.js';
import { Template, type TemplateResult } from '@/template/template.js';

export class MockBackend implements Backend {
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
    return 'user-blocking';
  }

  requestCallback<T>(
    callback: () => T | PromiseLike<T>,
    options: RequestCallbackOptions = {},
  ): Promise<T> {
    let promise: Promise<T>;

    const runCallbackIfNotCanceled = () => {
      options.signal?.throwIfAborted();
      return callback();
    };

    switch (options?.priority) {
      case 'user-visible':
        promise = new Promise((resolve) => setTimeout(resolve)).then(
          runCallbackIfNotCanceled,
        );
        break;
      case 'background':
        promise = new Promise((resolve) => setTimeout(resolve, 1)).then(
          runCallbackIfNotCanceled,
        );
        break;
      default:
        promise = Promise.resolve().then(runCallbackIfNotCanceled);
        break;
    }
    return options.signal !== undefined
      ? Promise.race([promise, waitForAbort<T>(options.signal)])
      : promise;
  }

  resolvePrimitive(_value: unknown, _part: Part): Primitive<unknown> {
    return new MockType();
  }

  resolveTemplate(
    strings: readonly string[],
    values: readonly unknown[],
    markerIdentifier: string,
    mode: TemplateMode,
  ): DirectiveType<readonly unknown[]> {
    return new MockTemplate(strings, values, markerIdentifier, mode);
  }

  startViewTransition(callback: () => void | Promise<void>): Promise<void> {
    return Promise.resolve().then(callback);
  }

  yieldToMain(): Promise<void> {
    return Promise.resolve();
  }
}

export class MockBinding<T> implements Binding<T> {
  readonly type: DirectiveType<T>;

  value: T;

  readonly part: Part;

  memoizedValue: T | null = null;

  dirty: boolean = false;

  committed: boolean = false;

  constructor(type: DirectiveType<T>, value: T, part: Part) {
    this.type = type;
    this.value = value;
    this.part = part;
  }

  shouldUpdate(value: T): boolean {
    return !Object.is(value, this.memoizedValue);
  }

  attach(_session: Session): void {
    this.dirty = true;
  }

  detach(_session: Session): void {
    this.dirty = true;
  }

  commit(): void {
    switch (this.part.type) {
      case PART_TYPE_ATTRIBUTE:
        this.part.node.setAttribute(
          this.part.name,
          this.value?.toString() ?? '',
        );
        break;
      case PART_TYPE_CHILD_NODE:
        this.part.sentinelNode.data = stringify(this.value);
        break;
      case PART_TYPE_ELEMENT:
        for (const name in this.value) {
          this.part.node.setAttribute(name, stringify(this.value[name]));
        }
        break;
      case PART_TYPE_LIVE:
      case PART_TYPE_PROPERTY:
        (this.part.node as any)[this.part.name] = this.value;
        break;
      case PART_TYPE_EVENT:
        this.part.node.addEventListener(
          this.part.name,
          this.value as EventListenerOrEventListenerObject,
        );
        break;
      case PART_TYPE_TEXT:
        this.part.node.data =
          this.part.precedingText +
          stringify(this.value) +
          this.part.followingText;
        break;
    }

    this.memoizedValue = this.value;
    this.dirty = false;
    this.committed = true;
  }

  rollback(): void {
    switch (this.part.type) {
      case PART_TYPE_ATTRIBUTE:
        this.part.node.removeAttribute(this.part.name);
        break;
      case PART_TYPE_ELEMENT:
        for (const name in this.value) {
          this.part.node.removeAttribute(name);
        }
        break;
      case PART_TYPE_LIVE:
      case PART_TYPE_PROPERTY:
        (this.part.node as any)[this.part.name] = this.part.defaultValue;
        break;
      case PART_TYPE_EVENT:
        this.part.node.removeEventListener(
          this.part.name,
          this.value as EventListenerOrEventListenerObject,
        );
        break;
      case PART_TYPE_CHILD_NODE:
        if (this.part.sentinelNode.data === this.memoizedValue) {
          this.part.sentinelNode.data = '';
        }
        break;
      case PART_TYPE_TEXT:
        this.part.node.data = '';
        break;
    }

    this.memoizedValue = null;
    this.dirty = false;
    this.committed = false;
  }
}

export class MockCoroutine implements Coroutine {
  name: string;

  scope: Scope;

  callback: (this: Coroutine, session: Session) => void;

  pendingLanes: Lanes = -1;

  constructor(
    name: string = MockCoroutine.name,
    scope: Scope = new Scope(),
    callback: (this: Coroutine, session: Session) => void = () => {},
  ) {
    this.name = name;
    this.scope = scope;
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
  static resolveBinding<T>(
    value: T,
    part: Part,
    _context: DirectiveContext,
  ): Binding<T> {
    return new MockBinding<T>(this, value, part);
  }
}

export class MockObserver implements SessionObserver {
  events: SessionEvent[] = [];

  onSessionEvent(event: SessionEvent): void {
    this.events.push(event);
  }

  flushEvents(): SessionEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }
}

export class MockTemplate extends Template<readonly unknown[]> {
  readonly strings: readonly string[];

  readonly values: readonly unknown[];

  readonly markerIdentifier: string;

  readonly mode: TemplateMode;

  constructor(
    strings: readonly string[] = [],
    values: readonly unknown[] = [],
    markerIdentifier = '',
    mode: TemplateMode = 'html',
  ) {
    super();
    this.strings = strings;
    this.values = values;
    this.markerIdentifier = markerIdentifier;
    this.mode = mode;
  }

  get arity(): number {
    return this.values.length;
  }

  render(
    _values: readonly unknown[],
    _part: Part.ChildNodePart,
    _session: Session,
  ): TemplateResult {
    return {
      childNodes: [],
      slots: [],
    };
  }

  hydrate(
    _values: readonly unknown[],
    _part: Part.ChildNodePart,
    _hydrationTarget: TreeWalker,
    _session: Session,
  ): TemplateResult {
    return {
      childNodes: [],
      slots: [],
    };
  }
}

export class MockType<T> implements DirectiveType<T> {
  readonly name: string;

  constructor(name: string = MockType.name) {
    this.name = name;
  }

  equals(other: unknown) {
    return other instanceof MockType && other.name === this.name;
  }

  resolveBinding(value: T, part: Part, _context: DirectiveContext): Binding<T> {
    return new MockBinding(this, value, part);
  }
}

export function createEffect(callback: () => void = () => {}): Effect {
  return { commit: vi.fn(callback) };
}

export function createEffectQueue(effects: Effect[]): EffectQueue {
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

export function createRuntime({
  defaultLanes,
  ...options
}: RuntimeOptions & { defaultLanes?: Lanes } = {}): Runtime {
  return new Runtime(new MockBackend(defaultLanes), options);
}

function stringify(value: unknown): string {
  return value?.toString() ?? '';
}

function waitForAbort<T>(signal: AbortSignal): Promise<T> {
  return new Promise<T>((_resolve, reject) => {
    signal.addEventListener('abort', () => {
      reject(signal.reason);
    });
  });
}
