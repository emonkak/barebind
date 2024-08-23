import {
  type AttributePart,
  type Binding,
  CommitStatus,
  type Effect,
  type ElementPart,
  type EventPart,
  type Part,
  PartType,
  type PropertyPart,
  type UpdateContext,
  resolveBinding,
} from './baseTypes.js';
import { ensureNonDirective, reportPart } from './error.js';

export type SpreadProps = { [key: string]: unknown };

export class AttributeBinding<T> implements Binding<T>, Effect {
  private _pendingValue: T;

  private _memoizedValue: T | null = null;

  private readonly _part: AttributePart;

  private _status = CommitStatus.Committed;

  constructor(value: T, part: AttributePart) {
    DEBUG: {
      ensureNonDirective(value, part);
    }
    this._pendingValue = value;
    this._part = part;
  }

  get value(): T {
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

  connect(context: UpdateContext): void {
    this._requestCommit(context);
    this._status = CommitStatus.Mounting;
  }

  bind(newValue: T, context: UpdateContext): void {
    DEBUG: {
      ensureNonDirective(newValue, this._part);
    }
    if (!Object.is(this._memoizedValue, newValue)) {
      this._requestCommit(context);
      this._pendingValue = newValue;
      this._status = CommitStatus.Mounting;
    }
  }

  unbind(context: UpdateContext): void {
    if (this._memoizedValue != null) {
      this._requestCommit(context);
      this._status = CommitStatus.Unmounting;
    } else {
      this._status = CommitStatus.Committed;
    }
  }

  disconnect(_context: UpdateContext): void {
    this._status = CommitStatus.Committed;
  }

  commit(): void {
    switch (this._status) {
      case CommitStatus.Mounting: {
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
      case CommitStatus.Unmounting: {
        const { node, name } = this._part;
        node.removeAttribute(name);
        this._memoizedValue = null;
        break;
      }
    }

    this._status = CommitStatus.Committed;
  }

  private _requestCommit(context: UpdateContext): void {
    if (this._status === CommitStatus.Committed) {
      context.enqueueMutationEffect(this);
    }
  }
}

export class ElementBinding implements Binding<SpreadProps> {
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

  get value(): SpreadProps {
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

  connect(context: UpdateContext): void {
    this._updateProps(this._value, context);
  }

  bind(newValue: SpreadProps, context: UpdateContext): void {
    DEBUG: {
      ensureSpreadProps(newValue, this._part);
    }
    this._updateProps(newValue, context);
    this._value = newValue;
  }

  unbind(context: UpdateContext): void {
    for (const binding of this._bindings.values()) {
      binding.unbind(context);
    }
  }

  disconnect(context: UpdateContext): void {
    for (const binding of this._bindings.values()) {
      binding.disconnect(context);
    }
  }

  private _updateProps(props: SpreadProps, context: UpdateContext): void {
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

export class EventBinding
  implements
    Binding<EventListenerOrEventListenerObject | null | undefined>,
    Effect
{
  private _pendingValue: EventListenerOrEventListenerObject | null | undefined;

  private _memoizedValue:
    | EventListenerOrEventListenerObject
    | null
    | undefined = null;

  private readonly _part: EventPart;

  private _status = CommitStatus.Committed;

  constructor(value: unknown, part: EventPart) {
    DEBUG: {
      ensureEventListener(value, part);
    }
    this._pendingValue = value;
    this._part = part;
  }

  get value(): EventListenerOrEventListenerObject | null | undefined {
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

  connect(context: UpdateContext): void {
    this._requestCommit(context);
    this._status = CommitStatus.Mounting;
  }

  bind(
    newValue: EventListenerOrEventListenerObject | null | undefined,
    context: UpdateContext,
  ): void {
    DEBUG: {
      ensureEventListener(newValue, this._part);
    }
    if (newValue !== this._memoizedValue) {
      this._requestCommit(context);
      this._pendingValue = newValue;
      this._status = CommitStatus.Mounting;
    }
  }

  unbind(context: UpdateContext): void {
    if (this._memoizedValue != null) {
      this._requestCommit(context);
      this._status = CommitStatus.Unmounting;
    } else {
      this._status = CommitStatus.Committed;
    }
  }

  disconnect(_context: UpdateContext): void {
    const value = this._memoizedValue;

    if (value != null) {
      this._detachLisetener(value);
      this._memoizedValue = null;
    }

    this._status = CommitStatus.Committed;
  }

  commit(): void {
    switch (this._status) {
      case CommitStatus.Mounting: {
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
      case CommitStatus.Unmounting: {
        const value = this._memoizedValue;

        /* istanbul ignore else @preserve */
        if (value != null) {
          this._detachLisetener(value);
        }

        this._memoizedValue = null;
        break;
      }
    }

    this._status = CommitStatus.Committed;
  }

  handleEvent(event: Event): void {
    const listener = this._memoizedValue!;
    if (typeof listener === 'function') {
      listener(event);
    } else {
      listener.handleEvent(event);
    }
  }

  private _attachLisetener(listener: EventListenerOrEventListenerObject): void {
    const { node, name } = this._part;

    if (typeof listener === 'function') {
      node.addEventListener(name, this);
    } else {
      node.addEventListener(name, this, listener as AddEventListenerOptions);
    }
  }

  private _detachLisetener(listener: EventListenerOrEventListenerObject): void {
    const { node, name } = this._part;

    if (typeof listener === 'function') {
      node.removeEventListener(name, this);
    } else {
      node.removeEventListener(name, this, listener as AddEventListenerOptions);
    }
  }

  private _requestCommit(context: UpdateContext): void {
    if (this._status === CommitStatus.Committed) {
      context.enqueueMutationEffect(this);
    }
  }
}

export class NodeBinding<T> implements Binding<T>, Effect {
  private _pendingValue: T;

  private _memoizedValue: T | null = null;

  private readonly _part: Part;

  private _status = CommitStatus.Committed;

  constructor(value: T, part: Part) {
    DEBUG: {
      ensureNonDirective(value, part);
    }
    this._pendingValue = value;
    this._part = part;
  }

  get value(): T {
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

  connect(context: UpdateContext): void {
    this._requestCommit(context);
    this._status = CommitStatus.Mounting;
  }

  bind(newValue: T, context: UpdateContext): void {
    DEBUG: {
      ensureNonDirective(newValue, this._part);
    }
    if (!Object.is(this._memoizedValue, newValue)) {
      this._requestCommit(context);
      this._pendingValue = newValue;
      this._status = CommitStatus.Mounting;
    }
  }

  unbind(context: UpdateContext): void {
    if (this._memoizedValue !== null) {
      this._requestCommit(context);
      this._status = CommitStatus.Unmounting;
    } else {
      this._status = CommitStatus.Committed;
    }
  }

  disconnect(_context: UpdateContext): void {
    this._status = CommitStatus.Committed;
  }

  commit(): void {
    switch (this._status) {
      case CommitStatus.Mounting:
        this._part.node.nodeValue =
          typeof this._pendingValue === 'string'
            ? this._pendingValue
            : this._pendingValue?.toString() ?? null;
        this._memoizedValue = this._pendingValue;
        break;

      case CommitStatus.Unmounting:
        this._part.node.nodeValue = null;
        this._memoizedValue = null;
        break;
    }

    this._status = CommitStatus.Committed;
  }

  private _requestCommit(context: UpdateContext): void {
    if (this._status === CommitStatus.Committed) {
      context.enqueueMutationEffect(this);
    }
  }
}

export class PropertyBinding<T> implements Binding<T>, Effect {
  private _pendingValue: T;

  private _memoizedValue: T | null = null;

  private readonly _part: PropertyPart;

  private _status = CommitStatus.Committed;

  constructor(value: T, part: PropertyPart) {
    DEBUG: {
      ensureNonDirective(value, part);
    }
    this._pendingValue = value;
    this._part = part;
  }

  get value(): T {
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

  connect(context: UpdateContext): void {
    this._requestCommit(context);
    this._status = CommitStatus.Mounting;
  }

  bind(newValue: T, context: UpdateContext): void {
    DEBUG: {
      ensureNonDirective(newValue, this._part);
    }
    if (!Object.is(this._memoizedValue, newValue)) {
      this._requestCommit(context);
      this._pendingValue = newValue;
      this._status = CommitStatus.Mounting;
    }
  }

  unbind(_context: UpdateContext): void {
    this._status = CommitStatus.Committed;
  }

  disconnect(_context: UpdateContext): void {
    this._status = CommitStatus.Committed;
  }

  commit(): void {
    switch (this._status) {
      case CommitStatus.Mounting: {
        const { node, name } = this._part;
        (node as any)[name] = this._pendingValue;
        this._memoizedValue = this._pendingValue;
        break;
      }
    }

    this._status = CommitStatus.Committed;
  }

  private _requestCommit(context: UpdateContext): void {
    if (this._status === CommitStatus.Committed) {
      context.enqueueMutationEffect(this);
    }
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
