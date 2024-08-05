import {
  type AttributePart,
  type Binding,
  BindingStatus,
  type DirectiveContext,
  type Effect,
  type ElementPart,
  type EventPart,
  type Part,
  PartType,
  type PropertyPart,
  type UpdateContext,
  directiveTag,
  isDirective,
} from './baseTypes.js';
import { ensureNonDirective, reportPart } from './error.js';

export class AttributeBinding implements Binding<unknown>, Effect {
  private _pendingValue: unknown;

  private _memoizedValue: unknown = null;

  private readonly _part: AttributePart;

  private _status = BindingStatus.Committed;

  constructor(value: unknown, part: AttributePart) {
    DEBUG: {
      ensureNonDirective(value, part);
    }
    this._pendingValue = value;
    this._part = part;
  }

  get value(): unknown {
    return this._pendingValue;
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

  connect(context: UpdateContext<unknown>): void {
    this._requestMutation(context, BindingStatus.Mounting);
  }

  bind(newValue: unknown, context: UpdateContext<unknown>): void {
    DEBUG: {
      ensureNonDirective(newValue, this._part);
    }
    if (!Object.is(this._memoizedValue, newValue)) {
      this._requestMutation(context, BindingStatus.Mounting);
      this._pendingValue = newValue;
    }
  }

  unbind(context: UpdateContext<unknown>): void {
    if (this._memoizedValue != null) {
      this._requestMutation(context, BindingStatus.Unmounting);
    }
  }

  disconnect(): void {}

  commit(): void {
    switch (this._status) {
      case BindingStatus.Mounting: {
        const { node, name } = this._part;
        const value = this._pendingValue;

        if (typeof value === 'string') {
          node.setAttribute(name, value);
        } else if (typeof value === 'boolean') {
          node.toggleAttribute(name, value);
        } else if (value == null) {
          node.removeAttribute(name);
        } else {
          node.setAttribute(name, value.toString());
        }

        this._memoizedValue = this._pendingValue;
        break;
      }
      case BindingStatus.Unmounting: {
        const { node, name } = this._part;
        node.removeAttribute(name);
        this._memoizedValue = null;
        break;
      }
    }

    this._status = BindingStatus.Committed;
  }

  private _requestMutation(
    context: UpdateContext<unknown>,
    newStatus: BindingStatus,
  ): void {
    if (this._status === BindingStatus.Committed) {
      context.enqueueMutationEffect(this);
    }
    this._status = newStatus;
  }
}

type SpreadProps = { [key: string]: unknown };

export class ElementBinding implements Binding<unknown> {
  private _value: SpreadProps;

  private readonly _part: ElementPart;

  private _bindings: Map<string, Binding<any>> = new Map();

  constructor(value: unknown, part: ElementPart) {
    DEBUG: {
      ensureSpreadProps(value, part);
    }
    this._value = value;
    this._part = part;
  }

  get value(): unknown {
    return this._value;
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

  get bindings(): Map<string, Binding<any>> {
    return this._bindings;
  }

  connect(context: UpdateContext<unknown>): void {
    this._updateProps(this._value, context);
  }

  bind(newValue: unknown, context: UpdateContext<unknown>): void {
    DEBUG: {
      ensureSpreadProps(newValue, this._part);
    }
    if (this._value !== newValue) {
      this._updateProps(newValue, context);
      this._value = newValue;
    }
  }

  unbind(context: UpdateContext<unknown>): void {
    for (const binding of this._bindings.values()) {
      binding.unbind(context);
    }
  }

  disconnect(): void {
    for (const binding of this._bindings.values()) {
      binding.disconnect();
    }
  }

  private _updateProps(
    props: SpreadProps,
    context: UpdateContext<unknown>,
  ): void {
    for (const [name, binding] of this._bindings.entries()) {
      if (!Object.hasOwn(props, name) || props[name] === undefined) {
        binding.unbind(context);
        this._bindings.delete(name);
      }
    }

    for (const name in props) {
      const value = props[name];
      if (value === undefined) {
        continue;
      }

      const binding = this._bindings.get(name);

      if (binding !== undefined) {
        binding.bind(value, context);
      } else {
        const part = resolveSpreadPart(name, this._part.node);
        const newBinding = resolveBinding(value, part, context);
        newBinding.connect(context);
        this._bindings.set(name, newBinding);
      }
    }
  }
}

export class EventBinding implements Binding<unknown>, Effect {
  private _pendingValue: EventListenerOrEventListenerObject | null | undefined;

  private _memoizedValue:
    | EventListenerOrEventListenerObject
    | null
    | undefined = null;

  private readonly _part: EventPart;

  private _status = BindingStatus.Committed;

  constructor(value: unknown, part: EventPart) {
    DEBUG: {
      ensureEventListener(value, part);
    }
    this._pendingValue = value;
    this._part = part;
  }

  get value(): unknown {
    return this._pendingValue;
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

  connect(context: UpdateContext<unknown>): void {
    this._requestMutation(context, BindingStatus.Mounting);
  }

  bind(newValue: unknown, context: UpdateContext<unknown>): void {
    DEBUG: {
      ensureEventListener(newValue, this._part);
    }
    if (newValue !== this._memoizedValue) {
      this._requestMutation(context, BindingStatus.Mounting);
      this._pendingValue = newValue;
    }
  }

  unbind(context: UpdateContext<unknown>): void {
    if (this._memoizedValue != null) {
      this._requestMutation(context, BindingStatus.Unmounting);
    }
  }

  disconnect(): void {
    const value = this._memoizedValue;

    if (value != null) {
      this._detachLisetener(value);
      this._memoizedValue = null;
    }
  }

  commit(): void {
    switch (this._status) {
      case BindingStatus.Mounting: {
        const oldValue = this._memoizedValue;
        const newValue = this._pendingValue;

        // If both old and new are functions, the event listener options are
        // the same. Therefore, there is no need to re-attach the event
        // listener.
        if (
          typeof oldValue === 'object' ||
          typeof newValue === 'object' ||
          oldValue === undefined ||
          newValue === undefined
        ) {
          if (oldValue != null) {
            this._detachLisetener(oldValue);
          }

          if (newValue != null) {
            this._attachLisetener(newValue);
          }
        }

        this._memoizedValue = this._pendingValue;
        break;
      }
      case BindingStatus.Unmounting: {
        const value = this._memoizedValue;

        /* istanbul ignore else @preserve */
        if (value != null) {
          this._detachLisetener(value);
        }

        this._memoizedValue = null;
        break;
      }
    }

    this._status = BindingStatus.Committed;
  }

  handleEvent(event: Event): void {
    const listener = this._memoizedValue!;
    if (typeof listener === 'function') {
      listener(event);
    } else {
      listener.handleEvent(event);
    }
  }

  private _attachLisetener(listener: EventListenerOrEventListenerObject) {
    const { node, name } = this._part;

    if (typeof listener === 'function') {
      node.addEventListener(name, this);
    } else {
      node.addEventListener(name, this, listener as AddEventListenerOptions);
    }
  }

  private _detachLisetener(listener: EventListenerOrEventListenerObject) {
    const { node, name } = this._part;

    if (typeof listener === 'function') {
      node.removeEventListener(name, this);
    } else {
      node.removeEventListener(name, this, listener as AddEventListenerOptions);
    }
  }

  private _requestMutation(
    context: UpdateContext<unknown>,
    newStatus: BindingStatus,
  ): void {
    if (this._status === BindingStatus.Committed) {
      context.enqueueMutationEffect(this);
    }
    this._status = newStatus;
  }
}

export class NodeBinding implements Binding<unknown>, Effect {
  private _pendingValue: unknown;

  private _memoizedValue: unknown = null;

  private readonly _part: Part;

  private _status = BindingStatus.Committed;

  constructor(value: unknown, part: Part) {
    DEBUG: {
      ensureNonDirective(value, part);
    }
    this._pendingValue = value;
    this._part = part;
  }

  get value(): unknown {
    return this._pendingValue;
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

  connect(context: UpdateContext<unknown>): void {
    this._requestMutation(context, BindingStatus.Mounting);
  }

  bind(newValue: unknown, context: UpdateContext<unknown>): void {
    DEBUG: {
      ensureNonDirective(newValue, this._part);
    }
    if (!Object.is(this._memoizedValue, newValue)) {
      this._requestMutation(context, BindingStatus.Mounting);
      this._pendingValue = newValue;
    }
  }

  unbind(context: UpdateContext<unknown>): void {
    if (this._memoizedValue !== null) {
      this._requestMutation(context, BindingStatus.Unmounting);
    }
  }

  disconnect(): void {}

  commit(): void {
    switch (this._status) {
      case BindingStatus.Mounting:
        this._part.node.nodeValue =
          typeof this._pendingValue === 'string'
            ? this._pendingValue
            : this._pendingValue?.toString() ?? null;
        this._memoizedValue = this._pendingValue;
        break;

      case BindingStatus.Unmounting:
        this._part.node.nodeValue = null;
        this._memoizedValue = null;
        break;
    }

    this._status = BindingStatus.Committed;
  }

  private _requestMutation(
    context: UpdateContext<unknown>,
    newStatus: BindingStatus,
  ): void {
    if (this._status === BindingStatus.Committed) {
      context.enqueueMutationEffect(this);
    }
    this._status = newStatus;
  }
}

export class PropertyBinding implements Binding<unknown>, Effect {
  private _pendingValue: unknown;

  private _memoizedValue: unknown = null;

  private readonly _part: PropertyPart;

  private _status = BindingStatus.Committed;

  constructor(value: unknown, part: PropertyPart) {
    DEBUG: {
      ensureNonDirective(value, part);
    }
    this._pendingValue = value;
    this._part = part;
  }

  get value(): unknown {
    return this._pendingValue;
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

  connect(context: UpdateContext<unknown>): void {
    this._requestMutation(context, BindingStatus.Mounting);
  }

  bind(newValue: unknown, context: UpdateContext<unknown>): void {
    DEBUG: {
      ensureNonDirective(newValue, this._part);
    }
    if (!Object.is(this._memoizedValue, newValue)) {
      this._requestMutation(context, BindingStatus.Mounting);
      this._pendingValue = newValue;
    }
  }

  unbind(_context: UpdateContext<unknown>): void {}

  disconnect(): void {}

  commit(): void {
    switch (this._status) {
      case BindingStatus.Mounting: {
        const { node, name } = this._part;
        (node as any)[name] = this._pendingValue;
        this._memoizedValue = this._pendingValue;
        break;
      }
    }

    this._status = BindingStatus.Committed;
  }

  private _requestMutation(
    context: UpdateContext<unknown>,
    newStatus: BindingStatus,
  ): void {
    if (this._status === BindingStatus.Committed) {
      context.enqueueMutationEffect(this);
    }
    this._status = newStatus;
  }
}

export function resolveBinding<TValue, TContext>(
  value: TValue,
  part: Part,
  context: DirectiveContext<TContext>,
): Binding<TValue, TContext> {
  if (isDirective(value)) {
    return value[directiveTag](part, context);
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
  part: Part,
): asserts value is EventListenerOrEventListenerObject | null | undefined {
  if (!(value == null || isEventListener(value))) {
    throw new Error(
      'A value of EventBinding must be EventListener, EventListenerObject, null or undefined.\n' +
        reportPart(part),
    );
  }
}

function ensureSpreadProps(
  value: unknown,
  part: Part,
): asserts value is SpreadProps {
  if (!(value != null && typeof value === 'object')) {
    throw new Error(
      'A value of ElementBinding must be an object, but got "' +
        value +
        '".' +
        reportPart(part),
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
