/// <reference path="../typings/scheduler.d.ts" />

import { ComponentBinding } from '@/component.js';
import {
  $toDirective,
  areDirectiveTypesEqual,
  type Backend,
  type Bindable,
  type Binding,
  type CommitContext,
  type CommitPhase,
  type Component,
  type Coroutine,
  type Directive,
  type DirectiveContext,
  type DirectiveType,
  type Effect,
  type HydrationTree,
  Lanes,
  type Part,
  PartType,
  type Primitive,
  type RenderContext,
  type RequestCallbackOptions,
  type Slot,
  type SlotType,
  type Template,
  type TemplateMode,
  type TemplateResult,
  type UpdateContext,
} from '@/core.js';
import type { RuntimeEvent, RuntimeObserver } from '@/runtime.js';
import { AbstractTemplate } from '@/template/template.js';

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

  isConnected: boolean = false;

  isCommitted: boolean = false;

  constructor(type: DirectiveType<T>, value: T, part: Part) {
    this.type = type;
    this.value = value;
    this.part = part;
  }

  shouldBind(_value: T): boolean {
    return true;
  }

  bind(value: T): void {
    this.value = value;
  }

  hydrate(_tree: HydrationTree, _context: UpdateContext): void {
    this.isConnected = true;
  }

  connect(_context: UpdateContext): void {
    this.isConnected = true;
  }

  disconnect(_context: UpdateContext): void {
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
        this.part.node.nodeValue = this.value?.toString() ?? null;
        break;
      case PartType.Element:
        for (const name in this.value) {
          this.part.node.setAttribute(name, this.value[name]?.toString() ?? '');
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
          (this.value?.toString() ?? '') +
          this.part.followingText;
        break;
    }

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
      case PartType.Text:
        this.part.node.nodeValue = null;
        break;
    }

    this.isCommitted = false;
  }
}

export class MockComponent implements Component<unknown, unknown> {
  get name(): string {
    return MockComponent.name;
  }

  render(_props: unknown, _context: RenderContext): unknown {
    return null;
  }

  shouldSkipUpdate(_nextProps: unknown, _prevProps: unknown): boolean {
    return false;
  }

  resolveBinding(
    props: unknown,
    part: Part,
    _context: DirectiveContext,
  ): Binding<unknown> {
    return new ComponentBinding(this, props, part);
  }
}

export class MockCoroutine implements Coroutine {
  resume(_lanes: Lanes, _context: UpdateContext): Lanes {
    return Lanes.NoLanes;
  }

  commit(): void {}
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
  commit(_context: CommitContext): void {}
}

export class MockCommitContext implements CommitContext {
  debugValue(
    _type: DirectiveType<unknown>,
    _value: unknown,
    _part: Part,
  ): void {}

  undebugValue(
    _type: DirectiveType<unknown>,
    _value: unknown,
    _part: Part,
  ): void {}
}

export class MockBackend implements Backend {
  commitEffects(
    effects: Effect[],
    _phase: CommitPhase,
    context: CommitContext,
  ): void {
    for (let i = 0, l = effects.length; i < l; i++) {
      effects[i]!.commit(context);
    }
  }

  getCurrentPriority(): TaskPriority {
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

export class MockRuntimeObserver implements RuntimeObserver {
  private _events: RuntimeEvent[] = [];

  onRuntimeEvent(event: RuntimeEvent): void {
    this._events.push(event);
  }

  flushEvents(): RuntimeEvent[] {
    const events = this._events;
    this._events = [];
    return events;
  }
}

export class MockSlot<T> implements Slot<T> {
  readonly binding: Binding<unknown>;

  isConnected = false;

  isCommitted = false;

  constructor(binding: Binding<unknown>) {
    this.binding = binding;
  }

  get type(): DirectiveType<unknown> {
    return this.binding.type;
  }

  get value(): unknown {
    return this.binding.value;
  }

  get part(): Part {
    return this.binding.part;
  }

  reconcile(value: T, context: UpdateContext): void {
    const directive = context.resolveDirective(value, this.binding.part);

    if (!areDirectiveTypesEqual(this.binding.type, directive.type)) {
      throw new Error(
        `The directive must be ${this.binding.type.name} in this slot, but got ${directive.type.name}.`,
      );
    }

    if (this.binding.shouldBind(directive.value)) {
      this.binding.bind(directive.value);
      this.binding.connect(context);
      this.isConnected = true;
    }
  }

  hydrate(tree: HydrationTree, context: UpdateContext): void {
    this.binding.hydrate(tree, context);
    this.isConnected = true;
  }

  connect(context: UpdateContext): void {
    this.binding.connect(context);
    this.isConnected = true;
  }

  disconnect(context: UpdateContext): void {
    this.binding.disconnect(context);
    this.isConnected = false;
  }

  commit(context: CommitContext): void {
    this.binding.commit(context);
    this.isCommitted = true;
  }

  rollback(context: CommitContext): void {
    this.binding.rollback(context);
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
    _context: UpdateContext,
  ): TemplateResult {
    return {
      childNodes: [],
      slots: [],
    };
  }

  hydrate(
    _binds: readonly unknown[],
    _part: Part.ChildNodePart,
    _tree: HydrationTree,
    _context: UpdateContext,
  ): TemplateResult {
    return {
      childNodes: [],
      slots: [],
    };
  }
}
