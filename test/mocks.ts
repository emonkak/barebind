/// <reference path="../typings/scheduler.d.ts" />

import {
  $toDirective,
  areDirectiveTypesEqual,
  type Bindable,
  type Binding,
  type CommitPhase,
  type Coroutine,
  type Directive,
  type DirectiveContext,
  type DirectiveType,
  type Effect,
  type HydrationTarget,
  Lanes,
  type Part,
  PartType,
  type Primitive,
  type RequestCallbackOptions,
  type Scope,
  type Slot,
  type SlotType,
  type Template,
  type TemplateFactory,
  type TemplateMode,
  type TemplateResult,
  type UnwrapBindable,
  type UpdateSession,
} from '@/internal.js';
import type {
  Runtime,
  RuntimeBackend,
  RuntimeEvent,
  RuntimeObserver,
} from '@/runtime.js';
import { AbstractTemplate } from '@/template/template.js';

export class MockBackend implements RuntimeBackend {
  commitEffects(effects: Effect[], _phase: CommitPhase): void {
    for (let i = 0, l = effects.length; i < l; i++) {
      effects[i]!.commit();
    }
  }

  flushUpdate(runtime: Runtime): void {
    runtime.flushSync();
  }

  getTaskPriority(): TaskPriority {
    return 'user-blocking';
  }

  getTemplateFactory(): TemplateFactory {
    return new MockTemplateFactory();
  }

  requestCallback(
    callback: () => Promise<void> | void,
    _options?: RequestCallbackOptions,
  ): Promise<void> {
    return Promise.resolve().then(callback);
  }

  resolvePrimitive(_value: unknown, _part: Part): Primitive<unknown> {
    return MockPrimitive;
  }

  resolveSlotType(_value: unknown, _part: Part): SlotType {
    return MockSlot;
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

  [$toDirective](): Directive<T> {
    return this.directive;
  }
}

export class MockBinding<T> implements Binding<T> {
  readonly type: DirectiveType<T>;

  pendingValue: T;

  memoizedValue: T | null = null;

  readonly part: Part;

  isConnected: boolean = false;

  isCommitted: boolean = false;

  constructor(type: DirectiveType<T>, value: T, part: Part) {
    this.type = type;
    this.pendingValue = value;
    this.part = part;
  }

  get value(): T {
    return this.pendingValue;
  }

  set value(value: T) {
    this.pendingValue = value;
  }

  shouldBind(value: T): boolean {
    return !Object.is(value, this.memoizedValue);
  }

  hydrate(_target: HydrationTarget, _session: UpdateSession): void {
    this.isConnected = true;
  }

  connect(_session: UpdateSession): void {
    this.isConnected = true;
  }

  disconnect(_session: UpdateSession): void {
    this.isConnected = false;
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
    this.isCommitted = true;
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
    this.isCommitted = false;
  }
}

export class MockCoroutine implements Coroutine {
  callback: (this: Coroutine, session: UpdateSession) => void;

  scope: Scope | null = null;

  pendingLanes: Lanes = Lanes.AllLanes;

  constructor(
    callback: (this: Coroutine, session: UpdateSession) => void = () => {},
  ) {
    this.callback = callback;
  }

  resume(session: UpdateSession): void {
    this.callback(session);
    this.pendingLanes &= ~session.frame.lanes;
  }
}

export class MockDirective<T> implements DirectiveType<T> {
  readonly name: string;

  constructor(name: string = this.constructor.name) {
    this.name = name;
  }

  equals(other: unknown) {
    return other instanceof MockDirective && other.name === this.name;
  }

  resolveBinding(value: T, part: Part, _context: DirectiveContext): Binding<T> {
    return new MockBinding(this, value, part);
  }
}

export const MockPrimitive = {
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

  isConnected = false;

  isCommitted = false;

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

  reconcile(value: T, session: UpdateSession): boolean {
    const directive = session.context.resolveDirective(
      value,
      this.binding.part,
    );

    if (!areDirectiveTypesEqual(this.binding.type, directive.type)) {
      throw new Error(
        `The directive must be ${this.binding.type.name} in this slot, but got ${directive.type.name}.`,
      );
    }

    const dirty = this.binding.shouldBind(directive.value);

    if (dirty) {
      this.binding.value = directive.value;
      this.binding.connect(session);
      this.isConnected = true;
    }

    return dirty;
  }

  hydrate(target: HydrationTarget, session: UpdateSession): void {
    this.binding.hydrate(target, session);
    this.isConnected = true;
  }

  connect(session: UpdateSession): void {
    this.binding.connect(session);
    this.isConnected = true;
  }

  disconnect(session: UpdateSession): void {
    this.binding.disconnect(session);
    this.isConnected = false;
  }

  commit(): void {
    this.binding.commit();
    this.isCommitted = true;
  }

  rollback(): void {
    this.binding.rollback();
    this.isCommitted = false;
  }
}

export class MockTemplate extends AbstractTemplate<readonly unknown[]> {
  readonly strings: readonly string[];

  readonly binds: readonly unknown[];

  readonly placeholder: string;

  readonly mode: TemplateMode;

  constructor(
    strings: readonly string[] = [],
    binds: readonly unknown[] = [],
    placeholder = '',
    mode: TemplateMode = 'html',
  ) {
    super();
    this.strings = strings;
    this.binds = binds;
    this.placeholder = placeholder;
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
      childNodes: [],
      slots: [],
    };
  }

  hydrate(
    _binds: readonly unknown[],
    _part: Part.ChildNodePart,
    _target: HydrationTarget,
    _session: UpdateSession,
  ): TemplateResult {
    return {
      childNodes: [],
      slots: [],
    };
  }
}

export class MockTemplateFactory implements TemplateFactory {
  parseTemplate(
    strings: readonly string[],
    binds: readonly unknown[],
    placeholder: string,
    mode: TemplateMode,
  ): Template<readonly unknown[]> {
    return new MockTemplate(strings, binds, placeholder, mode);
  }
}

function stringify(value: unknown): string {
  return value?.toString() ?? '';
}
