import { sequentialEqual, shallowEqual } from '../compare.js';
import {
  type Effect,
  type PrimitiveHandler,
  type Scope,
  type Session,
  wrap,
} from '../core.js';
import { Slot } from '../slot.js';
import {
  createAttributePart,
  createEventPart,
  createLivePart,
  createPropertyPart,
  type DOMPart,
} from './part.js';
import type { DOMRenderer } from './renderer.js';

const CSS_UPPERCASE_LETTER_PATTERN = /[A-Z]/g;
const CSS_VENDOR_PREFIX_PATTERN = /^(webkit|moz|ms|o)(?=[A-Z])/;

const CLASS_TOKEN_SEPARATOR_PATTERN = /\s+/;

export type ClassMap =
  | {
      readonly [index: number]: ClassToken;
    }
  | {
      readonly [key: string]: ClassToken;
    };

export type ClassToken = boolean | string | null | undefined;

export type ElementProps = { [key: string]: unknown };

export type Ref<T> =
  | {
      current: T | null;
    }
  | ((current: T) => Cleanup | void)
  | null
  | undefined;

export interface StyleMap extends CSSStyleProperties {
  [unknownProperty: string]: string | null | undefined;
}

type CSSStyleProperties = {
  [K in ExtractStringKeys<CSSStyleDeclaration>]?: string | null | undefined;
};

type Cleanup = () => void;

type EventListenerOrNullish =
  | (EventListenerOrEventListenerObject & AddEventListenerOptions)
  | null
  | undefined;

type ExtractStringKeys<T> = {
  [K in keyof T]: T[K] extends string ? K : never;
}[keyof T & string];

export class DOMPrimitiveHandler<TValue, TPart extends DOMPart>
  implements PrimitiveHandler<TValue, TPart, DOMRenderer>
{
  ensureValue(_value: unknown): void {}

  shouldUpdate(newValue: TValue, oldValue: TValue): boolean {
    return !Object.is(newValue, oldValue);
  }

  render(
    _value: TValue,
    _part: TPart,
    _scope: Scope.ChildScope<TPart, DOMRenderer>,
    _session: Session<TPart, DOMRenderer>,
  ): Iterable<Slot> {
    return [];
  }

  complete(
    _value: TValue,
    _part: TPart,
    _scope: Scope<TPart, DOMRenderer>,
    _session: Session<TPart, DOMRenderer>,
  ): void {}

  discard(
    _value: TValue,
    _part: TPart,
    _scope: Scope<TPart, DOMRenderer>,
    _session: Session<TPart, DOMRenderer>,
  ): void {}

  commit(_newValue: TValue, _oldValue: TValue, _part: TPart): void {}

  revert(_value: TValue, _part: TPart): void {}
}

export class DOMAttributeHandler<TValue> extends DOMPrimitiveHandler<
  TValue,
  DOMPart.AttributePart
> {
  override commit(
    newValue: TValue,
    _oldValue: TValue | null,
    part: DOMPart.AttributePart,
  ): void {
    const { node, name } = part;
    if (typeof newValue === 'boolean') {
      node.toggleAttribute(name, newValue);
    } else if (newValue == null) {
      node.removeAttribute(name);
    } else {
      node.setAttribute(name, toStringOrEmpty(newValue));
    }
  }

  override revert(_value: TValue, part: DOMPart.AttributePart): void {
    const { node, name } = part;
    node.removeAttribute(name);
  }
}

export class DOMClassHandler extends DOMPrimitiveHandler<
  ClassMap,
  DOMPart.AttributePart
> {
  override ensureValue(value: unknown): void {
    if (!isObject(value)) {
      throw new Error('Class values must be object.');
    }
  }

  override shouldUpdate(newTokens: ClassMap, oldTokens: ClassMap): boolean {
    return !shallowEqual(newTokens, oldTokens);
  }

  override commit(
    newTokens: ClassMap,
    oldTokens: ClassMap | null,
    part: DOMPart.AttributePart,
  ): void {
    updateClass(part.node.classList, oldTokens ?? {}, newTokens);
  }

  override revert(tokens: ClassMap, part: DOMPart.AttributePart): void {
    updateClass(part.node.classList, tokens, {});
  }
}

export class DOMElementHandler extends DOMPrimitiveHandler<
  ElementProps,
  DOMPart.ElementPart
> {
  private _pendingSlots: Map<string, Slot<DOMPart>> = new Map();

  private _currentSlots: Map<string, Slot<DOMPart>> = new Map();

  override ensureValue(value: unknown): void {
    if (!isObject(value)) {
      throw new Error('Element values must be object.');
    }
  }

  override render(
    props: ElementProps,
    part: DOMPart.ElementPart,
    scope: Scope.ChildScope<DOMPart.ElementPart, DOMRenderer>,
    session: Session<DOMPart.ElementPart, DOMRenderer>,
  ): Iterable<Slot> {
    const oldSlots = this._currentSlots;
    const newSlots = new Map();

    for (const [key, slot] of oldSlots.entries()) {
      if (!Object.hasOwn(props, key)) {
        slot.discard(session);
      }
    }

    for (const propName of Object.keys(props)) {
      const directive = wrap(props[propName]);
      let slot = oldSlots?.get(propName);
      if (slot !== undefined) {
        slot = slot.update(directive, scope);
      } else {
        const propPart = resolveNamedPart(propName, part.node);
        slot = new Slot(propPart, directive, scope);
      }
      newSlots.set(propName, slot);
    }

    this._pendingSlots = newSlots;

    return newSlots.values();
  }

  override discard(
    _props: ElementProps,
    _part: DOMPart.ElementPart,
    _scope: Scope<DOMPart.ElementPart, DOMRenderer>,
    session: Session<DOMPart.ElementPart, DOMRenderer>,
  ): void {
    for (const slot of this._currentSlots.values()) {
      slot.discard(session);
    }
    this._pendingSlots = new Map();
  }

  override commit(
    _newProps: ElementProps,
    _oldProps: ElementProps | null,
    _part: DOMPart.ElementPart,
  ): void {
    const oldSlots = this._currentSlots;
    const newSlots = this._pendingSlots;

    if (oldSlots !== null) {
      for (const [name, slot] of oldSlots) {
        if (!newSlots.has(name)) {
          slot.revert();
        }
      }
    }

    for (const slot of newSlots.values()) {
      slot.commit();
    }

    this._currentSlots = this._pendingSlots;
  }

  override revert(_props: ElementProps, _part: DOMPart.ElementPart): void {
    for (const slot of this._currentSlots.values()) {
      slot.revert();
    }

    this._currentSlots = new Map();
  }
}

export class DOMEventHandler extends DOMPrimitiveHandler<
  EventListenerOrNullish,
  DOMPart.EventPart
> {
  private _memoizedListener: EventListenerOrNullish;

  override ensureValue(
    value: unknown,
  ): asserts value is EventListenerOrNullish {
    if (!(isEventListener(value) || value == null)) {
      throw new Error(
        'Event values must be EventListener, EventListenerObject, null or undefined.',
      );
    }
  }

  override commit(
    newListener: EventListenerOrNullish,
    oldListener: EventListenerOrNullish,
    part: DOMPart.EventPart,
  ): void {
    if (
      newListener == null ||
      oldListener == null ||
      !compareEventListenerOptions(newListener, oldListener)
    ) {
      if (oldListener != null) {
        undelegateEvents(part, oldListener, this);
      }
      if (newListener != null) {
        delegateEvents(part, newListener, this);
      }
    }
    this._memoizedListener = newListener;
  }

  override revert(
    listener: EventListenerOrNullish,
    part: DOMPart.EventPart,
  ): void {
    if (listener != null) {
      undelegateEvents(part, listener, this);
    }
    this._memoizedListener = null;
  }

  handleEvent(event: Event): void {
    if (typeof this._memoizedListener === 'function') {
      this._memoizedListener(event);
    } else {
      this._memoizedListener?.handleEvent(event);
    }
  }
}

export class DOMLiveHandler<TValue> extends DOMPrimitiveHandler<
  TValue,
  DOMPart.LivePart
> {
  override shouldUpdate(_newValue: TValue, _oldValue: TValue): boolean {
    return true;
  }

  override commit(
    newValue: TValue,
    _oldValue: TValue | null,
    part: DOMPart.LivePart,
  ): void {
    const { node, name } = part;
    const currentValue = node[name as keyof Element];

    if (!Object.is(currentValue, newValue)) {
      (node as any)[name] = newValue;
    }
  }

  override revert(_value: TValue, part: DOMPart.LivePart): void {
    const { node, name, defaultValue } = part;
    (node as any)[name] = defaultValue;
  }
}

export class DOMNodeHandler<T> extends DOMPrimitiveHandler<T, DOMPart> {
  override commit(newValue: T, _oldValue: T | null, part: DOMPart): void {
    part.node.nodeValue = toStringOrEmpty(newValue);
  }

  override revert(_value: T, part: DOMPart): void {
    part.node.nodeValue = '';
  }
}

export class DOMPropertyHandler<T> extends DOMPrimitiveHandler<
  T,
  DOMPart.PropertyPart
> {
  override commit(
    newValue: T,
    _oldValue: T | null,
    part: DOMPart.PropertyPart,
  ): void {
    const { node, name } = part;
    (node as any)[name] = newValue;
  }

  override revert(_value: T, part: DOMPart.PropertyPart): void {
    const { node, name, defaultValue } = part;
    (node as any)[name] = defaultValue;
  }
}

export class DOMRefHandler extends DOMPrimitiveHandler<
  Ref<Element>,
  DOMPart.AttributePart
> {
  /** @internal */
  _memoizedRef: Ref<Element>;

  /** @internal */
  _memoizedCleanup: Cleanup | void | undefined;

  override ensureValue(value: unknown): void {
    if (!isRef(value) || value == null) {
      throw new Error(
        'Ref values must be RefFuction, RefObject, null or undefined.',
      );
    }
  }

  override complete(
    ref: Ref<Element>,
    part: DOMPart.AttributePart,
    scope: Scope<DOMPart.AttributePart, DOMRenderer>,
    session: Session<DOMPart.AttributePart, DOMRenderer>,
  ): void {
    session.layoutEffects.push(new InvokeRef(this, ref, part, scope));
  }

  override discard(
    _ref: Ref<Element>,
    _part: DOMPart.AttributePart,
    scope: Scope<DOMPart.AttributePart, DOMRenderer>,
    session: Session<DOMPart.AttributePart, DOMRenderer>,
  ): void {
    session.mutationEffects.push(new CleanupRef(this, scope));
  }
}

export class DOMStyleHandler extends DOMPrimitiveHandler<
  StyleMap,
  DOMPart.AttributePart
> {
  override ensureValue(value: unknown): void {
    if (!isObject(value)) {
      throw new Error('Style values must be object.');
    }
  }

  override shouldUpdate(newProps: StyleMap, oldProps: StyleMap): boolean {
    return !shallowEqual(newProps, oldProps);
  }

  override commit(
    newProps: StyleMap,
    oldProps: StyleMap | null,
    part: DOMPart.AttributePart,
  ): void {
    const declaration = (part.node as HTMLElement).style;
    updateStyle(declaration, oldProps ?? {}, newProps);
  }

  override revert(props: StyleMap, part: DOMPart.AttributePart): void {
    const declaration = (part.node as HTMLElement).style;
    updateStyle(declaration, props, {});
  }
}

function compareEventListenerOptions(
  newListener: EventListenerOrEventListenerObject,
  oldListener: EventListenerOrEventListenerObject,
): boolean {
  return sequentialEqual(
    getEventListenerOptions(newListener),
    getEventListenerOptions(oldListener),
  );
}

function delegateEvents(
  part: DOMPart.EventPart,
  listener: NonNullable<EventListenerOrNullish>,
  delegate: EventListenerObject,
): void {
  const { node, name } = part;
  node.addEventListener(name, delegate, listener);
}

function getEventListenerOptions(
  listener: EventListenerOrEventListenerObject,
): unknown[] {
  const { capture, once, passive, signal } =
    listener as AddEventListenerOptions;
  return [capture, once, passive, signal];
}

function isEventListener(
  value: any,
): value is EventListenerOrEventListenerObject {
  return (
    typeof value === 'function' || typeof value?.handleEvent === 'function'
  );
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

/**
 * Convert style property names expressed in lowerCamelCase to CSS style
 * propertes in kebab-case.
 *
 * @example
 * toCSSProperty('webkitFontSmoothing'); // => '-webkit-font-smoothing'
 * @example
 * toCSSProperty('paddingBlock'); // => 'padding-block'
 * @example
 * // returns the given property as is.
 * toCSSProperty('--my-css-property'); // => '--my-css-property'
 * toCSSProperty('padding-block'); // => 'padding-block'
 */
function toCSSPropertyName(key: string): string {
  return key
    .replace(CSS_VENDOR_PREFIX_PATTERN, '-$1')
    .replace(CSS_UPPERCASE_LETTER_PATTERN, (c) => '-' + c.toLowerCase());
}

function resolveNamedPart(key: string, node: Element): DOMPart {
  switch (key[0]) {
    case '$':
      return createLivePart(node, key.slice(1));
    case '.':
      return createPropertyPart(node, key.slice(1));
    case '@':
      return createEventPart(node, key.slice(1));
    default:
      return createAttributePart(node, key);
  }
}

function toStringOrEmpty(value: unknown): string {
  return value?.toString?.() ?? '';
}

function toggleClass(
  classList: DOMTokenList,
  key: string,
  token: ClassToken,
  enabled: boolean,
): void {
  if (typeof token === 'string') {
    token = token.trim();
  } else if (token) {
    token = key.trim();
  } else {
    return;
  }

  if (token !== '') {
    for (const component of token.split(CLASS_TOKEN_SEPARATOR_PATTERN)) {
      classList.toggle(component, enabled);
    }
  }
}

function undelegateEvents(
  part: DOMPart.EventPart,
  listener: NonNullable<EventListenerOrNullish>,
  delegate: EventListenerObject,
): void {
  const { node, name } = part;
  node.removeEventListener(name, delegate, listener);
}

function updateClass(
  classList: DOMTokenList,
  oldTokens: Record<string, ClassToken>,
  newTokens: Record<string, ClassToken>,
): void {
  for (const key of Object.keys(oldTokens)) {
    if (!Object.hasOwn(newTokens, key)) {
      toggleClass(classList, key, oldTokens[key], false);
    }
  }

  for (const key of Object.keys(newTokens)) {
    const newToken = newTokens[key];
    if (Object.hasOwn(oldTokens, key)) {
      const oldToken = oldTokens[key];
      if (newToken !== oldToken) {
        toggleClass(classList, key, oldToken, false);
      }
    }
    toggleClass(classList, key, newToken, true);
  }
}

function updateStyle(
  declaration: CSSStyleDeclaration,
  oldProps: StyleMap,
  newProps: StyleMap,
): void {
  for (const key of Object.keys(oldProps)) {
    if (
      oldProps[key] != null &&
      (!Object.hasOwn(newProps, key) || newProps[key] == null)
    ) {
      const name = toCSSPropertyName(key);
      declaration.removeProperty(name);
    }
  }

  for (const key of Object.keys(newProps)) {
    const value = newProps[key];
    if (value != null) {
      const name = toCSSPropertyName(key);
      declaration.setProperty(name, value);
    }
  }
}

function isRef(value: any): value is Ref<unknown> {
  return (
    value == null || typeof value === 'function' || value?.current !== undefined
  );
}

class CleanupRef implements Effect {
  private _handler: DOMRefHandler;
  private _scope: Scope;

  constructor(handler: DOMRefHandler, scope: Scope) {
    this._handler = handler;
    this._scope = scope;
  }

  get scope(): Scope {
    return this._scope;
  }

  commit(): void {
    const ref = this._handler._memoizedRef;

    if (ref != null) {
      if (typeof ref === 'function') {
        this._handler._memoizedCleanup?.();
      } else {
        ref.current = null;
      }
    }
  }
}

class InvokeRef implements Effect {
  private _handler: DOMRefHandler;
  private _ref: Ref<Element>;
  private _part: DOMPart.AttributePart;
  private _scope: Scope;

  constructor(
    handler: DOMRefHandler,
    ref: Ref<Element>,
    part: DOMPart.AttributePart,
    scope: Scope,
  ) {
    this._handler = handler;
    this._ref = ref;
    this._part = part;
    this._scope = scope;
  }

  get scope(): Scope {
    return this._scope;
  }

  commit(): void {
    const newRef = this._ref;
    const oldRef = this._handler._memoizedRef;

    if (newRef !== oldRef) {
      if (oldRef != null) {
        if (typeof oldRef === 'function') {
          this._handler._memoizedCleanup?.();
        } else {
          oldRef.current = null;
        }
      }

      if (newRef != null) {
        if (typeof newRef === 'function') {
          this._handler._memoizedCleanup = newRef(this._part.node);
        } else {
          newRef.current = this._part.node;
        }
      }
    }

    this._handler._memoizedRef = newRef;
  }
}
