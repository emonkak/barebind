/// <reference path="../typings/scheduler.d.ts" />

import type {
  Bindable,
  Binding,
  Coroutine,
  Directive,
  DirectiveContext,
  Effect,
  Primitive,
  Slot,
  SlotType,
  Template,
  TemplateBlock,
  TemplateMode,
  UpdateContext,
} from '../src/directive.js';
import { type CommitPhase, type Lanes, NO_LANES } from '../src/hook.js';
import type { HydrationTree } from '../src/hydration.js';
import { type ChildNodePart, type Part, PartType } from '../src/part.js';
import type { RenderHost, RequestCallbackOptions } from '../src/renderHost.js';
import { TaggedTemplate } from '../src/template/taggedTemplate.js';
import { TemplateBinding } from '../src/template/template.js';

export class MockDirective<T> {
  readonly name: string;

  constructor(name: string = this.constructor.name) {
    this.name = name;
  }

  resolveBinding(value: T, part: Part, _context: DirectiveContext): Binding<T> {
    return new MockBinding(this, value, part);
  }
}

export const MockPrimitive = new MockDirective<unknown>('MockPrimitive');

export class MockBinding<T> implements Binding<T> {
  private readonly _directive: Directive<T>;

  private _value: T;

  private readonly _part: Part;

  private _isConnected: boolean = false;

  private _isCommitted: boolean = false;

  constructor(directive: Directive<T>, value: T, part: Part) {
    this._directive = directive;
    this._value = value;
    this._part = part;
  }

  get directive(): Directive<T> {
    return this._directive;
  }

  get value(): T {
    return this._value;
  }

  get part(): Part {
    return this._part;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  get isCommitted(): boolean {
    return this._isCommitted;
  }

  shouldBind(_value: T): boolean {
    return true;
  }

  bind(value: T): void {
    this._value = value;
  }

  hydrate(_hydrationTree: HydrationTree, _context: UpdateContext): void {
    this._isConnected = true;
  }

  connect(_context: UpdateContext): void {
    this._isConnected = true;
  }

  disconnect(_context: UpdateContext): void {
    this._isConnected = false;
  }

  commit(): void {
    switch (this._part.type) {
      case PartType.Attribute:
        this._part.node.setAttribute(
          this._part.name,
          this._value?.toString() ?? '',
        );
        break;
      case PartType.Element:
        for (const name in this._value) {
          this._part.node.setAttribute(
            name,
            this._value[name]?.toString() ?? '',
          );
        }
        break;
      case PartType.Live:
      case PartType.Property:
        (this._part.node as any)[this._part.name] = this._value;
        break;
      case PartType.Event:
        this._part.node.addEventListener(
          this._part.name,
          this._value as EventListenerOrEventListenerObject,
        );
        break;
      case PartType.ChildNode:
      case PartType.Text:
        this._part.node.nodeValue = this._value?.toString() ?? null;
        break;
    }

    this._isCommitted = true;
  }

  rollback(): void {
    switch (this._part.type) {
      case PartType.Attribute:
        this._part.node.removeAttribute(this._part.name);
        break;
      case PartType.Element:
        for (const name in this._value) {
          this._part.node.removeAttribute(name);
        }
        break;
      case PartType.Live:
      case PartType.Property:
        (this._part.node as any)[this._part.name] = this._part.defaultValue;
        break;
      case PartType.Event:
        this._part.node.removeEventListener(
          this._part.name,
          this._value as EventListenerOrEventListenerObject,
        );
        break;
      case PartType.ChildNode:
      case PartType.Text:
        this._part.node.nodeValue = null;
        break;
    }

    this._isCommitted = false;
  }
}

export class MockCoroutine implements Coroutine {
  resume(_lanes: Lanes, _context: UpdateContext): Lanes {
    return NO_LANES;
  }

  commit(): void {}
}

export class MockRenderHost implements RenderHost {
  commitEffects(effects: Effect[], _phase: CommitPhase): void {
    for (let i = 0, l = effects.length; i < l; i++) {
      effects[i]!.commit();
    }
  }

  createTemplate(
    strings: readonly string[],
    binds: readonly unknown[],
    placeholder: string,
    mode: TemplateMode,
  ): Template<readonly unknown[]> {
    return TaggedTemplate.parse(strings, binds, placeholder, mode);
  }

  getCurrentTaskPriority(): TaskPriority {
    return 'user-blocking';
  }

  requestCallback(
    callback: () => Promise<void> | void,
    _options?: RequestCallbackOptions,
  ): Promise<void> {
    return Promise.resolve().then(callback);
  }

  resolvePrimitive(_part: Part): Primitive<unknown> {
    return MockPrimitive;
  }

  resolveSlotType(_part: Part): SlotType {
    return MockSlot;
  }

  startViewTransition(callback: () => void | Promise<void>): Promise<void> {
    return Promise.resolve().then(callback);
  }

  yieldToMain(): Promise<void> {
    return Promise.resolve();
  }
}

export class MockSlot<T> implements Slot<T> {
  private readonly _binding: Binding<T>;

  private _isConnected = false;

  private _isCommitted = false;

  constructor(binding: Binding<T>) {
    this._binding = binding;
  }

  get directive(): Directive<T> {
    return this._binding.directive;
  }

  get value(): T {
    return this._binding.value;
  }

  get part(): Part {
    return this._binding.part;
  }

  get binding(): Binding<T> {
    return this._binding;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  get isCommitted(): boolean {
    return this._isCommitted;
  }

  reconcile(value: Bindable<T>, context: UpdateContext): void {
    const element = context.resolveDirective(value, this._binding.part);
    if (element.directive !== this._binding.directive) {
      throw new Error(
        `The directive must be ${this._binding.directive.name} in this slot, but got ${element.directive.name}.`,
      );
    }
    if (this._binding.shouldBind(element.value)) {
      this._binding.bind(element.value);
      this._binding.connect(context);
      this._isConnected = true;
    }
  }

  hydrate(hydrationTree: HydrationTree, context: UpdateContext): void {
    this._binding.hydrate(hydrationTree, context);
    this._isConnected = true;
  }

  connect(context: UpdateContext): void {
    this._binding.connect(context);
    this._isConnected = true;
  }

  disconnect(context: UpdateContext): void {
    this._binding.disconnect(context);
    this._isConnected = false;
  }

  commit(): void {
    this._binding.commit();
    this._isCommitted = true;
  }

  rollback(): void {
    this._binding.rollback();
    this._isCommitted = false;
  }
}

export class MockTemplate implements Template<readonly unknown[]> {
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
    this.strings = strings;
    this.binds = binds;
    this.placeholder = placeholder;
    this.mode = mode;
  }

  get name(): string {
    return this.constructor.name;
  }

  render(
    _binds: readonly unknown[],
    _part: ChildNodePart,
    _context: UpdateContext,
  ): TemplateBlock {
    return {
      childNodes: [],
      slots: [],
    };
  }

  hydrate(
    _binds: readonly unknown[],
    _part: ChildNodePart,
    _hydrationTree: HydrationTree,
    _context: UpdateContext,
  ): TemplateBlock {
    return {
      childNodes: [],
      slots: [],
    };
  }

  resolveBinding(
    binds: readonly unknown[],
    part: Part,
    _context: DirectiveContext,
  ): Binding<readonly unknown[]> {
    if (part.type !== PartType.ChildNode) {
      throw new Error('MockTemplate must be used in a child node.');
    }
    return new TemplateBinding(this, binds, part);
  }
}
