import {
  type AttributePart,
  type Effect,
  type ElementPart,
  type EventPart,
  type Part,
  PartType,
  type PropertyPart,
  type Updater,
} from './types.js';

export const directiveTag = Symbol('Directive');

export interface Binding<TValue, TContext = unknown> {
  get value(): TValue;
  get part(): Part;
  get startNode(): ChildNode;
  get endNode(): ChildNode;
  connect(updater: Updater<TContext>): void;
  bind(newValue: TValue, updater: Updater<TContext>): void;
  unbind(updater: Updater<TContext>): void;
  disconnect(): void;
}

export interface Directive<TContext = unknown> {
  [directiveTag](
    part: Part,
    updater: Updater<TContext>,
  ): Binding<ThisType<this>>;
}

export class AttributeBinding implements Binding<unknown>, Effect {
  private _value: unknown;

  private readonly _part: AttributePart;

  private _dirty = false;

  constructor(value: unknown, part: AttributePart) {
    DEBUG: {
      ensureNonDirective(value);
    }
    this._value = value;
    this._part = part;
  }

  get value(): unknown {
    return this._value;
  }

  get part(): AttributePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  connect(updater: Updater): void {
    this._requestMutation(updater);
  }

  bind(newValue: unknown, updater: Updater): void {
    DEBUG: {
      ensureNonDirective(newValue);
    }
    if (!Object.is(this._value, newValue)) {
      this._value = newValue;
      this._requestMutation(updater);
    }
  }

  unbind(updater: Updater): void {
    if (this._value !== null) {
      this._value = null;
      this._requestMutation(updater);
    }
  }

  disconnect(): void {}

  commit(): void {
    const { node, name } = this._part;
    const value = this._value;

    if (typeof value === 'string') {
      node.setAttribute(name, value);
    } else if (typeof value === 'boolean') {
      node.toggleAttribute(name, value);
    } else if (value == null) {
      node.removeAttribute(name);
    } else {
      node.setAttribute(name, value.toString());
    }

    this._dirty = false;
  }

  private _requestMutation(updater: Updater): void {
    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }
}

export class EventBinding implements Binding<unknown>, Effect {
  private _pendingListener: EventListenerOrEventListenerObject | null;

  private _memoizedListener: EventListenerOrEventListenerObject | null = null;

  private readonly _part: EventPart;

  private _dirty = false;

  constructor(value: unknown, part: EventPart) {
    ensureEventListener(value);
    this._pendingListener = value;
    this._part = part;
  }

  get value(): unknown {
    return this._pendingListener;
  }

  get part(): EventPart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  connect(updater: Updater): void {
    this._requestMutation(updater);
  }

  bind(newValue: unknown, updater: Updater): void {
    ensureEventListener(newValue);
    if (this._memoizedListener !== newValue) {
      this._pendingListener = newValue;
      this._requestMutation(updater);
    }
  }

  unbind(updater: Updater): void {
    if (this._memoizedListener !== null) {
      this._requestMutation(updater);
    }

    this._pendingListener = null;
  }

  disconnect(): void {
    const listener = this._memoizedListener;

    if (listener !== null) {
      const { node, name } = this._part;

      if (typeof listener === 'function') {
        node.removeEventListener(name, this);
      } else {
        node.removeEventListener(
          name,
          this,
          listener as AddEventListenerOptions,
        );
      }

      this._memoizedListener = null;
    }

    this._pendingListener = null;
  }

  commit(): void {
    const oldListener = this._memoizedListener;
    const newListener = this._pendingListener;

    // If both are functions, the event listener options are the same.
    // Therefore, there is no need to re-register the event listener.
    if (typeof oldListener === 'object' || typeof newListener === 'object') {
      if (oldListener !== null) {
        const { node, name } = this._part;

        if (typeof oldListener === 'function') {
          node.removeEventListener(name, this);
        } else {
          node.removeEventListener(
            name,
            this,
            oldListener as AddEventListenerOptions,
          );
        }
      }

      if (newListener !== null) {
        const { node, name } = this._part;

        if (typeof newListener === 'function') {
          node.addEventListener(name, this);
        } else {
          node.addEventListener(
            name,
            this,
            newListener as AddEventListenerOptions,
          );
        }
      }
    }

    this._memoizedListener = this._pendingListener;
    this._dirty = false;
  }

  handleEvent(event: Event): void {
    const listener = this._memoizedListener!;
    if (typeof listener === 'function') {
      listener(event);
    } else {
      listener.handleEvent(event);
    }
  }

  private _requestMutation(updater: Updater): void {
    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }
}

export class NodeBinding implements Binding<unknown>, Effect {
  private _value: unknown;

  private readonly _part: Part;

  private _dirty = false;

  constructor(value: unknown, part: Part) {
    DEBUG: {
      ensureNonDirective(value);
    }
    this._value = value;
    this._part = part;
  }

  get value(): unknown {
    return this._value;
  }

  get part(): Part {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  connect(updater: Updater): void {
    this._requestMutation(updater);
  }

  bind(newValue: unknown, updater: Updater): void {
    DEBUG: {
      ensureNonDirective(newValue);
    }
    if (!Object.is(this._value, newValue)) {
      this._value = newValue;
      this._requestMutation(updater);
    }
  }

  unbind(updater: Updater): void {
    if (this._value !== null) {
      this._value = null;
      this._requestMutation(updater);
    }
  }

  disconnect(): void {}

  commit(): void {
    this._part.node.nodeValue =
      typeof this._value === 'string'
        ? this._value
        : this._value?.toString() ?? null;
    this._dirty = false;
  }

  private _requestMutation(updater: Updater): void {
    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }
}

export class PropertyBinding implements Binding<unknown>, Effect {
  private _value: unknown;

  private readonly _part: PropertyPart;

  private _dirty = false;

  constructor(value: unknown, part: PropertyPart) {
    DEBUG: {
      ensureNonDirective(value);
    }
    this._value = value;
    this._part = part;
  }

  get value(): unknown {
    return this._value;
  }

  get part(): PropertyPart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  connect(updater: Updater): void {
    this._requestMutation(updater);
  }

  bind(newValue: unknown, updater: Updater): void {
    DEBUG: {
      ensureNonDirective(newValue);
    }
    if (!Object.is(this._value, newValue)) {
      this._value = newValue;
      this._requestMutation(updater);
    }
  }

  unbind(_updater: Updater): void {}

  disconnect(): void {}

  commit(): void {
    const { node, name } = this._part;
    (node as any)[name] = this._value;
    this._dirty = false;
  }

  private _requestMutation(updater: Updater): void {
    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }
}

export class ElementBinding implements Binding<unknown> {
  private _props: { [key: string]: unknown };

  private readonly _part: ElementPart;

  private _bindings: Map<string, Binding<unknown>> = new Map();

  constructor(value: unknown, part: ElementPart) {
    ensureSpreadProps(value);
    this._props = value;
    this._part = part;
  }

  get value(): unknown {
    return this._props;
  }

  get part(): ElementPart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  connect(updater: Updater): void {
    this._updateProps(updater);
  }

  bind(newValue: unknown, updater: Updater): void {
    ensureSpreadProps(newValue);
    if (this._props !== newValue) {
      this._props = newValue;
      this._updateProps(updater);
    }
  }

  unbind(updater: Updater): void {
    this._props = {};
    for (const binding of this._bindings.values()) {
      binding.unbind(updater);
    }
  }

  disconnect(): void {
    for (const binding of this._bindings.values()) {
      binding.disconnect();
    }
  }

  private _updateProps(updater: Updater): void {
    for (const [name, binding] of this._bindings.entries()) {
      if (
        !Object.hasOwn(this._props, name) ||
        this._props[name] === undefined
      ) {
        binding.unbind(updater);
        this._bindings.delete(name);
      }
    }

    for (const name in this._props) {
      const value = this._props[name];
      if (value === undefined) {
        continue;
      }

      let binding = this._bindings.get(name);

      if (binding !== undefined) {
        binding.bind(value, updater);
      } else {
        const part = resolveSpreadPart(name, this._part.node);
        binding = resolveBinding(value, part, updater);
        binding.connect(updater);
        this._bindings.set(name, binding);
      }
    }
  }
}

export function ensureDirective<TExpectedClass extends Function>(
  expectedClass: TExpectedClass,
  actualValue: unknown,
): asserts actualValue is TExpectedClass {
  if (!(actualValue instanceof expectedClass)) {
    throw new Error(
      'A value must be a instance of "' +
        expectedClass.name +
        '", but got "' +
        actualValue +
        '". Consider using choice(), condition() or dynamic() directive instead.',
    );
  }
}

export function isDirective(value: unknown): value is Directive<unknown> {
  return value !== null && typeof value === 'object' && directiveTag in value;
}

export function mount<TValue, TContext>(
  value: TValue,
  container: ChildNode,
  updater: Updater<TContext>,
): Binding<TValue> {
  const part = {
    type: PartType.ChildNode,
    node: document.createComment(''),
  } as const;

  updater.enqueueMutationEffect({
    commit() {
      container.appendChild(part.node);
    },
  });

  const binding = resolveBinding(value, part, updater);

  binding.connect(updater);

  if (!updater.isScheduled()) {
    updater.scheduleUpdate();
  }

  return binding;
}

export function resolveBinding<TValue, TContext>(
  value: TValue,
  part: Part,
  updater: Updater<TContext>,
): Binding<TValue, TContext> {
  if (isDirective(value)) {
    return value[directiveTag](part, updater) as Binding<TValue, TContext>;
  } else {
    return resolvePrimitiveBinding(value, part) as Binding<TValue, TContext>;
  }
}

export function resolvePrimitiveBinding(
  value: unknown,
  part: Part,
): Binding<unknown> {
  switch (part.type) {
    case PartType.Attribute:
      return new AttributeBinding(value, part);
    case PartType.ChildNode:
      return new NodeBinding(value, part);
    case PartType.Element:
      return new ElementBinding(value, part);
    case PartType.Event:
      return new EventBinding(value, part);
    case PartType.Node:
      return new NodeBinding(value, part);
    case PartType.Property:
      return new PropertyBinding(value, part);
  }
}

function ensureEventListener(
  value: unknown,
): asserts value is EventListenerOrEventListenerObject | null {
  if (!(value === null || isEventListener(value))) {
    throw new Error(
      'A value of EventBinding must be EventListener, EventListenerObject or null.',
    );
  }
}

function ensureNonDirective(value: unknown): void {
  if (isDirective(value)) {
    throw new Error(
      'A value must not be a directive, but got "' +
        value +
        '". Consider using choice(), condition() or dynamic() directive instead.',
    );
  }
}

function ensureSpreadProps(
  value: unknown,
): asserts value is { [key: string]: unknown } {
  if (!(value != null && typeof value === 'object')) {
    throw new Error(
      'A value of ElementBinding must be an object, but got "' + value + '".',
    );
  }
}

function isEventListener(
  value: unknown,
): value is EventListenerOrEventListenerObject {
  return (
    typeof value === 'function' ||
    (typeof value === 'object' &&
      typeof (value as any)?.handleEvent === 'function')
  );
}

function resolveSpreadPart(name: string, element: Element): Part {
  if (name.length > 1 && name[0] === '@') {
    return { type: PartType.Event, node: element, name: name.slice(1) };
  } else if (name.length > 1 && name[0] === '.') {
    return { type: PartType.Property, node: element, name: name.slice(1) };
  } else {
    return { type: PartType.Attribute, node: element, name };
  }
}
