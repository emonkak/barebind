/// <reference path="../typings/scheduler.d.ts" />

import {
  $toDirective,
  areDirectiveTypesEqual,
  type Bindable,
  type Binding,
  CommitPhase,
  type Coroutine,
  type Directive,
  type DirectiveContext,
  type DirectiveType,
  type Effect,
  Lanes,
  type Layout,
  type Part,
  PartType,
  type Primitive,
  type RequestCallbackOptions,
  type Scope,
  type Slot,
  type Template,
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
import { createScope } from '@/scope.js';
import { AbstractTemplate } from '@/template/template.js';

export class MockBackend implements RuntimeBackend {
  commitEffects(effects: Effect[], phase: CommitPhase): void {
    switch (phase) {
      case CommitPhase.Mutation:
      case CommitPhase.Layout:
        for (let i = effects.length - 1; i >= 0; i--) {
          effects[i]!.commit();
        }
        break;
      case CommitPhase.Passive:
        for (let i = 0, l = effects.length; i < l; i++) {
          effects[i]!.commit();
        }
        break;
    }
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
    placeholder: string,
    mode: TemplateMode,
  ): Template<readonly unknown[]> {
    return new MockTemplate(strings, binds, placeholder, mode);
  }

  requestCallback<T>(
    callback: () => T | PromiseLike<T>,
    _options?: RequestCallbackOptions,
  ): Promise<T> {
    return Promise.resolve().then(callback);
  }

  resolveLayout(_value: unknown, _part: Part): Layout {
    return MockLayout;
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

  [$toDirective](): Directive<T> {
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

  scope: Scope;

  pendingLanes: Lanes;

  constructor(
    callback: (this: Coroutine, session: UpdateSession) => void = () => {},
    scope: Scope = createScope(),
    pendingLanes: Lanes = Lanes.AllLanes,
  ) {
    this.callback = callback;
    this.scope = scope;
    this.pendingLanes = pendingLanes;
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

  get displayName(): string {
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
  displayName: 'MockPrimitive',
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

export const MockLayout: Layout = {
  displayName: 'MockLayout',
  resolveSlot<T>(binding: Binding<UnwrapBindable<T>>) {
    return new MockSlot(binding);
  },
};

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

  reconcile(value: T, session: UpdateSession): boolean {
    const { context } = session;
    const directive = context.resolveDirective(value, this.binding.part);

    if (!areDirectiveTypesEqual(this.binding.type, directive.type)) {
      throw new Error(
        `The directive must be ${this.binding.type.displayName} in this slot, but got ${directive.type.displayName}.`,
      );
    }

    const dirty = this.binding.shouldUpdate(directive.value);

    if (dirty) {
      this.binding.value = directive.value;
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
      children: [],
      slots: [],
    };
  }

  hydrate(
    _binds: readonly unknown[],
    _part: Part.ChildNodePart,
    _treeWalker: TreeWalker,
    _session: UpdateSession,
  ): TemplateResult {
    return {
      children: [],
      slots: [],
    };
  }
}

function stringify(value: unknown): string {
  return value?.toString() ?? '';
}
