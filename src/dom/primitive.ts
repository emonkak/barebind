import { sequentialEqual, shallowEqual } from '../compare.js';
import { type Mountable, type Scope, type Session, wrap } from '../core.js';
import { Slot } from '../slot.js';
import { DOMRenderError } from './error.js';
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

export type ClassMap = {
  readonly [key: string]: boolean;
};

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

export class DOMPrimitive<TValue, TPart extends DOMPart>
  implements Mountable<TValue, TPart, DOMRenderer>
{
  protected _value: TValue;

  static shouldUpdate(newValue: unknown, oldValue: unknown): boolean {
    return !Object.is(newValue, oldValue);
  }

  static ensureValue(_value: unknown, _part: DOMPart): void {}

  static render<TValue, TPart extends DOMPart>(
    value: TValue,
    _part: DOMPart,
    _scope: Scope.ChildScope<DOMPart>,
    _session: Session<DOMPart, DOMRenderer>,
  ): DOMPrimitive<TValue, TPart> {
    return new this(value);
  }

  constructor(value: TValue) {
    this._value = value;
  }

  get children(): Slot<DOMPart>[] {
    return [];
  }

  patch(
    value: TValue,
    _part: TPart,
    _scope: Scope.ChildScope<TPart>,
    _session: Session<TPart, DOMRenderer>,
  ): void {
    this._value = value;
  }

  mount(_part: TPart): void {}

  afterMount(_part: TPart): void {}

  beforeUnmount(_part: TPart): void {}

  unmount(_part: TPart): void {}
}

export class DOMAttribute<TValue> extends DOMPrimitive<
  TValue,
  DOMPart.AttributePart
> {
  override mount(part: DOMPart.AttributePart): void {
    const { node, name } = part;
    if (typeof this._value === 'boolean') {
      node.toggleAttribute(name, this._value);
    } else if (this._value == null) {
      node.removeAttribute(name);
    } else {
      node.setAttribute(name, toStringOrEmpty(this._value));
    }
  }

  override unmount(part: DOMPart.AttributePart): void {
    const { node, name } = part;
    node.removeAttribute(name);
  }
}

export class DOMClass extends DOMPrimitive<ClassMap, DOMPart.AttributePart> {
  private _memoizedValue: ClassMap = {};

  static override shouldUpdate(
    newTokens: ClassMap,
    oldTokens: ClassMap,
  ): boolean {
    return !shallowEqual(newTokens, oldTokens);
  }

  static override ensureValue(
    value: unknown,
    part: DOMPart.AttributePart,
  ): void {
    if (!isObject(value)) {
      throw DOMRenderError.fromPlace(part, 'Class values must be object.');
    }
  }

  override mount(part: DOMPart.AttributePart): void {
    updateClass(part.node.classList, this._memoizedValue, this._value);
    this._memoizedValue = this._value;
  }

  override unmount(part: DOMPart.AttributePart): void {
    updateClass(part.node.classList, this._value, {});
    this._memoizedValue = {};
  }
}

export class DOMElement
  implements Mountable<ElementProps, DOMPart.ElementPart, DOMRenderer>
{
  private _pendingSlots: Map<string, Slot<DOMPart>> = new Map();

  private _currentSlots: Map<string, Slot<DOMPart>> = new Map();

  static shouldUpdate(oldProps: ElementProps, newProps: ElementProps): boolean {
    return oldProps !== newProps;
  }

  static ensureValue(value: unknown, part: DOMPart.ElementPart): void {
    if (!isObject(value)) {
      throw DOMRenderError.fromPlace(part, 'Element values must be object.');
    }
  }

  static render(
    props: ElementProps,
    part: DOMPart.ElementPart,
    scope: Scope.ChildScope<DOMPart.ElementPart>,
    _session: Session<DOMPart.ElementPart, DOMRenderer>,
  ): DOMElement {
    const slots = new Map<string, Slot<DOMPart>>();

    for (const propName of Object.keys(props)) {
      const propPart = resolveNamedPart(propName, part.node);
      const directive = wrap(props[propName]);
      const slot = new Slot(propPart, directive, scope);
      slots.set(propName, slot);
    }

    return new DOMElement(slots);
  }

  constructor(slots: Map<string, Slot<DOMPart>>) {
    this._pendingSlots = slots;
  }

  get children(): Iterable<Slot<DOMPart>> {
    return this._pendingSlots.values();
  }

  patch(
    props: ElementProps,
    part: DOMPart.ElementPart,
    scope: Scope.ChildScope<DOMPart.ElementPart>,
    _session: Session<DOMPart.ElementPart, DOMRenderer>,
  ): void {
    const oldSlots = this._currentSlots;
    const newSlots = new Map();

    for (const propName of Object.keys(props)) {
      const directive = wrap(props[propName]);
      let slot = oldSlots?.get(propName);
      if (slot !== undefined) {
        slot.update(directive, scope);
      } else {
        const propPart = resolveNamedPart(propName, part.node);
        slot = new Slot(propPart, directive, scope);
      }
      newSlots.set(propName, slot);
    }

    this._pendingSlots = newSlots;
  }

  mount(_part: DOMPart.ElementPart): void {
    const oldSlots = this._currentSlots;
    const newSlots = this._pendingSlots;

    for (const [name, slot] of oldSlots) {
      if (!newSlots.has(name)) {
        slot.beforeRevert();
        slot.revert();
      }
    }

    for (const slot of newSlots.values()) {
      slot.commit();
    }

    this._currentSlots = this._pendingSlots;
  }

  afterMount(_part: DOMPart.ElementPart): void {
    for (const slot of this._currentSlots.values()) {
      slot.afterCommit();
    }
  }

  beforeUnmount(_part: DOMPart.ElementPart): void {
    for (const slot of this._currentSlots.values()) {
      slot.beforeRevert();
    }
  }

  unmount(_part: DOMPart.ElementPart): void {
    for (const slot of this._currentSlots.values()) {
      slot.revert();
    }
    this._currentSlots = new Map();
  }
}

export class DOMEvent extends DOMPrimitive<
  EventListenerOrNullish,
  DOMPart.EventPart
> {
  private _memoizedValue: EventListenerOrNullish;

  static override ensureValue(value: unknown, part: DOMPart.EventPart): void {
    if (!(isEventListener(value) || value == null)) {
      throw DOMRenderError.fromPlace(
        part,
        'Event values must be EventListener, EventListenerObject, null or undefined.',
      );
    }
  }

  override mount(part: DOMPart.EventPart): void {
    const newListener = this._value;
    const oldListener = this._memoizedValue;

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
    this._memoizedValue = newListener;
  }

  override unmount(part: DOMPart.EventPart): void {
    if (this._value != null) {
      undelegateEvents(part, this._value, this);
    }
    this._memoizedValue = null;
  }

  handleEvent(event: Event): void {
    if (typeof this._memoizedValue === 'function') {
      this._memoizedValue(event);
    } else {
      this._memoizedValue?.handleEvent(event);
    }
  }
}

export class DOMLive<TValue> extends DOMPrimitive<TValue, DOMPart.LivePart> {
  static override shouldUpdate(
    _newValue: unknown,
    _oldValue: unknown,
  ): boolean {
    return true;
  }

  override mount(part: DOMPart.LivePart): void {
    const { node, name } = part;
    const currentValue = node[name as keyof Element];

    if (!Object.is(currentValue, this._value)) {
      (node as any)[name] = this._value;
    }
  }

  override unmount(part: DOMPart.LivePart): void {
    const { node, name, defaultValue } = part;
    (node as any)[name] = defaultValue;
  }
}

export class DOMNode<T> extends DOMPrimitive<T, DOMPart> {
  override mount(part: DOMPart): void {
    part.node.nodeValue = toStringOrEmpty(this._value);
  }

  override unmount(part: DOMPart): void {
    part.node.nodeValue = '';
  }
}

export class DOMProperty<T> extends DOMPrimitive<T, DOMPart.PropertyPart> {
  override mount(part: DOMPart.PropertyPart): void {
    const { node, name } = part;
    (node as any)[name] = this._value;
  }

  override unmount(part: DOMPart.PropertyPart): void {
    const { node, name, defaultValue } = part;
    (node as any)[name] = defaultValue;
  }
}

export class DOMRef extends DOMPrimitive<Ref<Element>, DOMPart.AttributePart> {
  private _memoizedValue: Ref<Element>;

  private _memoizedCleanup: Cleanup | void | undefined;

  static override ensureValue(
    value: unknown,
    part: DOMPart.AttributePart,
  ): void {
    if (!isRef(value)) {
      throw DOMRenderError.fromPlace(
        part,
        'Ref values must be RefFuction, RefObject, null or undefined.',
      );
    }
  }

  override afterMount(part: DOMPart.AttributePart): void {
    const newRef = this._value;
    const oldRef = this._memoizedValue;

    if (newRef !== oldRef) {
      if (typeof oldRef === 'function') {
        this._memoizedCleanup?.();
      } else if (oldRef != null) {
        oldRef.current = null;
      }

      if (typeof newRef === 'function') {
        this._memoizedCleanup = newRef(part.node);
      } else if (newRef != null) {
        newRef.current = part.node;
      }
    }

    this._memoizedValue = newRef;
  }

  override beforeUnmount(_part: DOMPart.AttributePart): void {
    const ref = this._memoizedValue;

    if (typeof ref === 'function') {
      this._memoizedCleanup?.();
    } else if (ref != null) {
      ref.current = null;
    }
  }
}

export class DOMStyle extends DOMPrimitive<StyleMap, DOMPart.AttributePart> {
  private _memoizedValue: StyleMap = {};

  static override shouldUpdate(
    newProps: StyleMap,
    oldProps: StyleMap,
  ): boolean {
    return !shallowEqual(newProps, oldProps);
  }

  static override ensureValue(
    value: unknown,
    part: DOMPart.AttributePart,
  ): void {
    if (!isObject(value)) {
      throw DOMRenderError.fromPlace(part, 'Style values must be object.');
    }
  }

  override mount(part: DOMPart.AttributePart): void {
    updateStyle(
      (part.node as HTMLElement).style,
      this._memoizedValue,
      this._value,
    );
  }

  override unmount(part: DOMPart.AttributePart): void {
    updateStyle((part.node as HTMLElement).style, this._memoizedValue, {});
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
  enabled: boolean,
): void {
  for (const token of key.trim().split(CLASS_TOKEN_SEPARATOR_PATTERN)) {
    if (token !== '') {
      classList.toggle(token, enabled);
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
  oldTokens: ClassMap,
  newTokens: ClassMap,
): void {
  for (const key of Object.keys(oldTokens)) {
    if (!Object.hasOwn(newTokens, key)) {
      toggleClass(classList, key, false);
    }
  }

  for (const key of Object.keys(newTokens)) {
    toggleClass(classList, key, newTokens[key]!);
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
