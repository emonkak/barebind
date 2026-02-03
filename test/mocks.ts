/// <reference path="../typings/scheduler.d.ts" />

import {
  $directive,
  areDirectiveTypesEqual,
  type Bindable,
  type Binding,
  type CommitPhase,
  type Coroutine,
  createScope,
  type Directive,
  type DirectiveContext,
  type DirectiveType,
  type Effect,
  EffectQueue,
  Lanes,
  type Layout,
  type Part,
  PartType,
  type Primitive,
  type RenderFrame,
  type RequestCallbackOptions,
  type Scope,
  type Slot,
  type Template,
  type TemplateMode,
  type TemplateResult,
  type UnwrapBindable,
  type UpdateSession,
} from '@/internal.js';
import {
  Runtime,
  type RuntimeBackend,
  type RuntimeEvent,
  type RuntimeObserver,
  type RuntimeOptions,
} from '@/runtime.js';
import { AbstractTemplate } from '@/template/template.js';

export class MockBackend implements RuntimeBackend {
  flushEffects(effects: EffectQueue, _phase: CommitPhase): void {
    effects.flush();
  }

  flushUpdate(runtime: Runtime): void {
    runtime.flushSync();
  }

  getTaskPriority(): TaskPriority {
    return 'user-blocking';
  }

  parseTemplate(
    strings: readonly string[],
    binds: readonly unknown[],
    markerToken: string,
    mode: TemplateMode,
  ): Template<readonly unknown[]> {
    return new MockTemplate(strings, binds, markerToken, mode);
  }

  requestCallback<T>(
    callback: () => T | PromiseLike<T>,
    _options?: RequestCallbackOptions,
  ): Promise<T> {
    return Promise.resolve().then(callback);
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
  directive: Partial<Directive<T>>;

  constructor(directive: Partial<Directive<T>>) {
    this.directive = directive;
  }

  [$directive](): Partial<Directive<T>> {
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
      case PartType.Attribute:
        this.part.node.setAttribute(
          this.part.name,
          this.value?.toString() ?? '',
        );
        break;
      case PartType.ChildNode:
        // For part debugging, update comments only if the data is empty.
        if (
          this.part.node.data === '' ||
          this.part.node.data === stringify(this.memoizedValue)
        ) {
          this.part.node.data = stringify(this.value);
        }
        break;
      case PartType.Element:
        for (const name in this.value) {
          this.part.node.setAttribute(name, stringify(this.value[name]));
        }
        break;
      case PartType.Live:
      case PartType.Property:
        (this.part.node as any)[this.part.name] = this.value;
        break;
      case PartType.Event:
        this.part.node.addEventListener(
          this.part.name,
          this.value as EventListenerOrEventListenerObject,
        );
        break;
      case PartType.Text:
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
      case PartType.Attribute:
        this.part.node.removeAttribute(this.part.name);
        break;
      case PartType.Element:
        for (const name in this.value) {
          this.part.node.removeAttribute(name);
        }
        break;
      case PartType.Live:
      case PartType.Property:
        (this.part.node as any)[this.part.name] = this.part.defaultValue;
        break;
      case PartType.Event:
        this.part.node.removeEventListener(
          this.part.name,
          this.value as EventListenerOrEventListenerObject,
        );
        break;
      case PartType.ChildNode:
        if (this.part.node.data === this.memoizedValue) {
          this.part.node.data = '';
        }
        break;
      case PartType.Text:
        this.part.node.data = '';
        break;
    }

    this.memoizedValue = null;
    this.dirty = false;
    this.committed = false;
  }
}

export class MockCoroutine implements Coroutine {
  callback: (this: Coroutine, session: UpdateSession) => void;

  pendingLanes: Lanes;

  scope: Scope;

  constructor(
    callback: (this: Coroutine, session: UpdateSession) => void = () => {},
    pendingLanes: Lanes = Lanes.AllLanes,
    scope: Scope = createScope(),
  ) {
    this.callback = callback;
    this.scope = scope;
    this.pendingLanes = pendingLanes;
  }

  get name(): string {
    return MockCoroutine.name;
  }

  resume(session: UpdateSession): void {
    this.callback(session);
    this.pendingLanes &= ~session.frame.lanes;
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

export class MockEffect implements Effect {
  commit(): void {}
}

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

export class MockObserver implements RuntimeObserver {
  events: RuntimeEvent[] = [];

  onRuntimeEvent(event: RuntimeEvent): void {
    this.events.push(event);
  }

  flushEvents(): RuntimeEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }
}

export class MockSlot<T> implements Slot<T> {
  readonly binding: Binding<UnwrapBindable<T>>;

  dirty = false;

  committed = false;

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
    this.dirty = true;
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
      this.dirty = true;
    }

    return dirty;
  }

  detach(session: UpdateSession): void {
    this.binding.detach(session);
    this.dirty = true;
  }

  commit(): void {
    this.binding.commit();
    this.dirty = false;
    this.committed = true;
  }

  rollback(): void {
    this.binding.rollback();
    this.dirty = false;
    this.committed = false;
  }
}

export class MockTemplate extends AbstractTemplate<readonly unknown[]> {
  readonly strings: readonly string[];

  readonly binds: readonly unknown[];

  readonly markerToken: string;

  readonly mode: TemplateMode;

  constructor(
    strings: readonly string[] = [],
    binds: readonly unknown[] = [],
    markerToken = '',
    mode: TemplateMode = 'html',
  ) {
    super();
    this.strings = strings;
    this.binds = binds;
    this.markerToken = markerToken;
    this.mode = mode;
  }

  get arity(): number {
    return this.binds.length;
  }

  render(
    _binds: readonly unknown[],
    _part: Part.ChildNodePart,
    _session: UpdateSession,
  ): TemplateResult {
    return {
      children: [],
      slots: [],
    };
  }

  hydrate(
    _binds: readonly unknown[],
    _part: Part.ChildNodePart,
    _targetTree: TreeWalker,
    _session: UpdateSession,
  ): TemplateResult {
    return {
      children: [],
      slots: [],
    };
  }
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
    pendingCoroutines: [],
    mutationEffects: new EffectQueue(),
    layoutEffects: new EffectQueue(),
    passiveEffects: new EffectQueue(),
  };
}

export function createRuntime(options?: RuntimeOptions): Runtime {
  return new Runtime(new MockBackend(), options);
}

function stringify(value: unknown): string {
  return value?.toString() ?? '';
}
