import { sequentialEqual, shallowEqual } from '../compare.js';
import {
  type PrimitiveHandler,
  type Scope,
  type Session,
  wrap,
} from '../core.js';
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

export class DOMPrimitiveHandler<TValue, TPart extends DOMPart>
  implements PrimitiveHandler<TValue, TPart, DOMRenderer>
{
  ensureValue(_value: unknown, _part: TPart): void {}

  shouldUpdate(newValue: TValue, oldValue: TValue): boolean {
    return !Object.is(newValue, oldValue);
  }

  render(
    _value: TValue,
    _part: TPart,
    _scope: Scope.ChildScope<TPart>,
    _session: Session<TPart, DOMRenderer>,
  ): Iterable<Slot> {
    return [];
  }

  mount(_value: TValue, _part: TPart): void {}

  remount(_oldValue: TValue, newValue: TValue, part: TPart): void {
    this.mount(newValue, part);
  }

  afterMount(_value: TValue, _part: TPart): void {}

  beforeUnmount(_value: TValue, _part: TPart): void {}

  unmount(_value: TValue, _part: TPart): void {}
}

export class DOMAttributeHandler<TValue> extends DOMPrimitiveHandler<
  TValue,
  DOMPart.AttributePart
> {
  override mount(newValue: TValue, part: DOMPart.AttributePart): void {
    const { node, name } = part;
    if (typeof newValue === 'boolean') {
      node.toggleAttribute(name, newValue);
    } else if (newValue == null) {
      node.removeAttribute(name);
    } else {
      node.setAttribute(name, toStringOrEmpty(newValue));
    }
  }

  override unmount(_value: TValue, part: DOMPart.AttributePart): void {
    const { node, name } = part;
    node.removeAttribute(name);
  }
}

export class DOMClassHandler extends DOMPrimitiveHandler<
  ClassMap,
  DOMPart.AttributePart
> {
  override ensureValue(value: unknown, part: DOMPart.AttributePart): void {
    if (!isObject(value)) {
      throw DOMRenderError.fromPlace(part, 'Class values must be object.');
    }
  }

  override shouldUpdate(newTokens: ClassMap, oldTokens: ClassMap): boolean {
    return !shallowEqual(newTokens, oldTokens);
  }

  override mount(tokens: ClassMap, part: DOMPart.AttributePart): void {
    updateClass(part.node.classList, {}, tokens);
  }

  override remount(
    oldTokens: ClassMap,
    newTokens: ClassMap,
    part: DOMPart.AttributePart,
  ): void {
    updateClass(part.node.classList, oldTokens, newTokens);
  }

  override unmount(tokens: ClassMap, part: DOMPart.AttributePart): void {
    updateClass(part.node.classList, tokens, {});
  }
}

export class DOMElementHandler extends DOMPrimitiveHandler<
  ElementProps,
  DOMPart.ElementPart
> {
  private _pendingSlots: Map<string, Slot<DOMPart>> = new Map();

  private _currentSlots: Map<string, Slot<DOMPart>> = new Map();

  override ensureValue(value: unknown, part: DOMPart.ElementPart): void {
    if (!isObject(value)) {
      throw DOMRenderError.fromPlace(part, 'Element values must be object.');
    }
  }

  override render(
    props: ElementProps,
    part: DOMPart.ElementPart,
    scope: Scope.ChildScope<DOMPart.ElementPart>,
    _session: Session<DOMPart.ElementPart, DOMRenderer>,
  ): Iterable<Slot> {
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

    return newSlots.values();
  }

  override mount(_newProps: ElementProps, _part: DOMPart.ElementPart): void {
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

  override afterMount(_props: ElementProps, _part: DOMPart.ElementPart): void {
    for (const slot of this._currentSlots.values()) {
      slot.afterCommit();
    }
  }

  override beforeUnmount(
    _props: ElementProps,
    _part: DOMPart.ElementPart,
  ): void {
    for (const slot of this._currentSlots.values()) {
      slot.beforeRevert();
    }
  }

  override unmount(_props: ElementProps, _part: DOMPart.ElementPart): void {
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

  override ensureValue(value: unknown, part: DOMPart.EventPart): void {
    if (!(isEventListener(value) || value == null)) {
      throw DOMRenderError.fromPlace(
        part,
        'Event values must be EventListener, EventListenerObject, null or undefined.',
      );
    }
  }

  override mount(
    listener: EventListenerOrNullish,
    part: DOMPart.EventPart,
  ): void {
    const newListener = listener;
    const oldListener = this._memoizedListener;

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

  override unmount(
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

  override mount(newValue: TValue, part: DOMPart.LivePart): void {
    const { node, name } = part;
    const currentValue = node[name as keyof Element];

    if (!Object.is(currentValue, newValue)) {
      (node as any)[name] = newValue;
    }
  }

  override unmount(_value: TValue, part: DOMPart.LivePart): void {
    const { node, name, defaultValue } = part;
    (node as any)[name] = defaultValue;
  }
}

export class DOMNodeHandler<T> extends DOMPrimitiveHandler<T, DOMPart> {
  override mount(newValue: T, part: DOMPart): void {
    part.node.nodeValue = toStringOrEmpty(newValue);
  }

  override unmount(_value: T, part: DOMPart): void {
    part.node.nodeValue = '';
  }
}

export class DOMPropertyHandler<T> extends DOMPrimitiveHandler<
  T,
  DOMPart.PropertyPart
> {
  override mount(newValue: T, part: DOMPart.PropertyPart): void {
    const { node, name } = part;
    (node as any)[name] = newValue;
  }

  override unmount(_value: T, part: DOMPart.PropertyPart): void {
    const { node, name, defaultValue } = part;
    (node as any)[name] = defaultValue;
  }
}

export class DOMRefHandler extends DOMPrimitiveHandler<
  Ref<Element>,
  DOMPart.AttributePart
> {
  private _memoizedRef: Ref<Element>;

  private _memoizedCleanup: Cleanup | void | undefined;

  override ensureValue(value: unknown, part: DOMPart.AttributePart): void {
    if (!isRef(value) || value == null) {
      throw DOMRenderError.fromPlace(
        part,
        'Ref values must be RefFuction, RefObject, null or undefined.',
      );
    }
  }

  override afterMount(ref: Ref<Element>, part: DOMPart.AttributePart): void {
    const newRef = ref;
    const oldRef = this._memoizedRef;

    if (newRef !== oldRef) {
      if (oldRef != null) {
        if (typeof oldRef === 'function') {
          this._memoizedCleanup?.();
        } else {
          oldRef.current = null;
        }
      }

      if (newRef != null) {
        if (typeof newRef === 'function') {
          this._memoizedCleanup = newRef(part.node);
        } else {
          newRef.current = part.node;
        }
      }
    }

    this._memoizedRef = newRef;
  }

  override beforeUnmount(
    _ref: Ref<Element>,
    _part: DOMPart.AttributePart,
  ): void {
    const ref = this._memoizedRef;

    if (ref != null) {
      if (typeof ref === 'function') {
        this._memoizedCleanup?.();
      } else {
        ref.current = null;
      }
    }
  }
}

export class DOMStyleHandler extends DOMPrimitiveHandler<
  StyleMap,
  DOMPart.AttributePart
> {
  override ensureValue(value: unknown, part: DOMPart.AttributePart): void {
    if (!isObject(value)) {
      throw DOMRenderError.fromPlace(part, 'Style values must be object.');
    }
  }

  override shouldUpdate(newProps: StyleMap, oldProps: StyleMap): boolean {
    return !shallowEqual(newProps, oldProps);
  }

  override mount(props: StyleMap, part: DOMPart.AttributePart): void {
    updateStyle((part.node as HTMLElement).style, {}, props);
  }

  override remount(
    oldProps: StyleMap,
    newProps: StyleMap,
    part: DOMPart.AttributePart,
  ): void {
    updateStyle((part.node as HTMLElement).style, oldProps, newProps);
  }

  override unmount(props: StyleMap, part: DOMPart.AttributePart): void {
    updateStyle((part.node as HTMLElement).style, props, {});
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
