/// <reference path="../typings/scheduler.d.ts" />

import { vi } from 'vitest';
import {
  $directive,
  type Backend,
  type Bindable,
  type Binding,
  type CommitPhase,
  type Coroutine,
  type Directive,
  type DirectiveContext,
  type DirectiveType,
  type Effect,
  EffectQueue,
  type Lanes,
  type Layout,
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
  type Scope,
  type SessionEvent,
  type SessionObserver,
  SLOT_STATUS_ATTACHED,
  SLOT_STATUS_DETACHED,
  SLOT_STATUS_IDLE,
  type Slot,
  type SlotStatus,
  type Template,
  type TemplateMode,
  type TemplateResult,
  type UnwrapBindable,
  type UpdateSession,
} from '@/core.js';
import { areDirectiveTypesEqual } from '@/directive.js';
import { SyncLane } from '@/lane.js';
import { Runtime, type RuntimeOptions } from '@/runtime.js';
import { AbstractTemplate } from '@/template/template.js';

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

  parseTemplate(
    strings: readonly string[],
    values: readonly unknown[],
    markerIdentifier: string,
    mode: TemplateMode,
  ): Template<readonly unknown[]> {
    return new MockTemplate(strings, values, markerIdentifier, mode);
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

  resolveLayout(_value: unknown, _part: Part): Layout {
    return new MockLayout();
  }

  resolvePrimitive(_value: unknown, _part: Part): Primitive<unknown> {
    return MockPrimitive;
  }

  startViewTransition(callback: () => void | Promise<void>): Promise<void> {
    return Promise.resolve().then(callback);
  }

  yieldToMain(): Promise<void> {
    return Promise.resolve();
  }
}

export class MockBindable<T> implements Bindable<T> {
  directive: Directive<T>;

  constructor(directive: Directive<T>) {
    this.directive = directive;
  }

  [$directive](): Directive<T> {
    return this.directive;
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

  attach(_session: UpdateSession): void {
    this.dirty = true;
  }

  detach(_session: UpdateSession): void {
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
        // For part debugging, update comments only if the data is empty.
        if (
          this.part.sentinelNode.data === '' ||
          this.part.sentinelNode.data === stringify(this.memoizedValue)
        ) {
          this.part.sentinelNode.data = stringify(this.value);
        }
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

  callback: (this: Coroutine, session: UpdateSession) => void;

  pendingLanes: Lanes = -1;

  constructor(
    name: string = MockCoroutine.name,
    scope: Scope = createScope(),
    callback: (this: Coroutine, session: UpdateSession) => void = () => {},
  ) {
    this.name = name;
    this.scope = scope;
    this.callback = callback;
  }

  start(session: UpdateSession): void {
    session.frame.coroutines.push(this);
  }

  resume(session: UpdateSession): void {
    this.callback(session);
  }
}

export class MockDirective<T> implements DirectiveType<T> {
  readonly id: string;

  constructor(id: string = '') {
    this.id = id;
  }

  get name(): string {
    return MockDirective.name;
  }

  equals(other: unknown) {
    return other instanceof MockDirective && other.id === this.id;
  }

  resolveBinding(value: T, part: Part, _context: DirectiveContext): Binding<T> {
    return new MockBinding(this, value, part);
  }
}

export const MockPrimitive: Primitive<any> = {
  name: 'MockPrimitive',
  ensureValue(_value: unknown): asserts _value is unknown {},
  resolveBinding(
    value: unknown,
    part: Part,
    _context: DirectiveContext,
  ): Binding<unknown> {
    return new MockBinding(this, value, part);
  },
};

export class MockLayout implements Layout {
  layout: Layout | null = null;

  constructor(layout: Layout | null = null) {
    this.layout = layout;
  }

  get name(): string {
    return 'MockLayout';
  }

  compose(): Layout {
    return new MockLayout(this);
  }

  placeBinding<T>(binding: Binding<UnwrapBindable<T>>) {
    return new MockSlot(binding);
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

export class MockSlot<T> implements Slot<T> {
  readonly binding: Binding<UnwrapBindable<T>>;

  status: SlotStatus = SLOT_STATUS_IDLE;

  constructor(binding: Binding<UnwrapBindable<T>>) {
    this.binding = binding;
  }

  get type(): DirectiveType<UnwrapBindable<T>> {
    return this.binding.type;
  }

  get value(): UnwrapBindable<T> {
    return this.binding.value;
  }

  get part(): Part {
    return this.binding.part;
  }

  attach(session: UpdateSession): void {
    this.binding.attach(session);
    this.status = SLOT_STATUS_ATTACHED;
  }

  detach(session: UpdateSession): void {
    this.binding.detach(session);
    this.status = SLOT_STATUS_DETACHED;
  }

  reconcile(source: T, session: UpdateSession): boolean {
    const { context } = session;
    const { type, value } = context.resolveDirective(source, this.binding.part);

    if (!areDirectiveTypesEqual(this.binding.type, type)) {
      throw new Error(
        `The directive must be ${this.binding.type.name} in the slot, but got ${type.name}.`,
      );
    }

    const dirty = this.binding.shouldUpdate(value);

    if (dirty) {
      this.binding.value = value;
      this.binding.attach(session);
      this.status = SLOT_STATUS_ATTACHED;
    }

    return dirty;
  }

  commit(): void {
    this.binding.commit();
    this.status = SLOT_STATUS_IDLE;
  }

  rollback(): void {
    this.binding.rollback();
    this.status = SLOT_STATUS_IDLE;
  }
}

export class MockTemplate extends AbstractTemplate<readonly unknown[]> {
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
    _session: UpdateSession,
  ): TemplateResult {
    return {
      childNodes: [],
      slots: [],
    };
  }

  hydrate(
    _values: readonly unknown[],
    _part: Part.ChildNodePart,
    _target: TreeWalker,
    _session: UpdateSession,
  ): TemplateResult {
    return {
      childNodes: [],
      slots: [],
    };
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

export function createScope(owner: Coroutine | null = null): Scope {
  return {
    owner,
    level: owner !== null ? owner.scope.level + 1 : 0,
    boundary: null,
  };
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
