import { sequentialEqual } from '../compare.js';

const CLASS_TOKEN_SEPARATOR_PATTERN = /\s+/;

const CSS_UPPERCASE_LETTER_PATTERN = /[A-Z]/g;
const CSS_VENDOR_PREFIX_PATTERN = /^(webkit|moz|ms|o)(?=[A-Z])/;

interface ClassMap {
  readonly [key: string]: boolean;
}

interface StyleMap {
  readonly [key: string]: string | null | undefined;
}

export abstract class DOMPart<TNode extends ChildNode = ChildNode> {
  protected readonly _node: TNode;

  protected _value: unknown = null;

  constructor(node: TNode) {
    this._node = node;
  }

  get node(): TNode {
    return this._node;
  }

  get value(): unknown {
    return this._value;
  }

  set value(newValue: unknown) {
    if (this._needsUpdate(this._value, newValue)) {
      this._update(this._value, newValue);
    }
    this._value = newValue;
  }

  afterCommit(): void {}

  beforeRemove(): void {}

  protected _needsUpdate(oldValue: unknown, newValue: unknown): boolean {
    return !Object.is(oldValue, newValue);
  }

  protected abstract _update(oldValue: unknown, newValue: unknown): void;
}

export class AttributePart extends DOMPart<Element> {
  private readonly _name: string;

  constructor(node: Element, name: string) {
    super(node);
    this._name = name;
  }

  protected _update(oldValue: unknown, newValue: unknown): void {
    if (this._name === 'class' && isObject(newValue)) {
      if (!isObject(oldValue)) {
        this._node.className = '';
        oldValue = {};
      }
      updateClass(
        this._node.classList,
        oldValue as ClassMap,
        newValue as ClassMap,
      );
    } else if (this._name === 'style' && isObject(newValue)) {
      if (!isObject(oldValue)) {
        (this._node as HTMLElement).style = '';
        oldValue = {};
      }
      updateStyle(
        (this._node as HTMLElement).style,
        oldValue as StyleMap,
        newValue as StyleMap,
      );
    } else if (newValue == null) {
      this._node.removeAttribute(this._name);
    } else if (typeof newValue === 'boolean') {
      this._node.toggleAttribute(this._name, newValue);
    } else {
      this._node.setAttribute(this._name, toStringOrEmpty(newValue));
    }
  }
}

export class CharacterDataPart extends DOMPart<CharacterData> {
  protected _update(_oldValue: unknown, newValue: unknown): void {
    this._node.data = toStringOrEmpty(newValue);
  }
}

export class ElementPart extends DOMPart<Element> {
  private _cleanup: (() => void) | void | undefined;

  private _dirty: boolean = false;

  protected _update(_oldValue: unknown, newValue: unknown): void {
    if (!(newValue == null || typeof newValue === 'function')) {
      throw new TypeError(
        'Element values must be an function, null or undefined.',
      );
    }
    this._dirty = true;
  }

  override afterCommit(): void {
    if (this._dirty) {
      this._cleanup?.();
      this._cleanup = (this._value as Function)?.(this._node);
      this._dirty = false;
    }
  }

  override beforeRemove(): void {
    this._cleanup?.();
    this._cleanup = undefined;
  }
}

export class EventPart extends DOMPart<Element> implements EventListenerObject {
  private readonly _name: string;

  constructor(node: Element, name: string) {
    super(node);
    this._name = name;
  }

  handleEvent(event: Event): void {
    if (typeof this._value === 'function') {
      this._value(event);
    } else {
      (this._value as EventListenerObject)?.handleEvent(event);
    }
  }

  protected _update(oldValue: unknown, newValue: unknown): void {
    if (!isEventListenerOrNullable(newValue)) {
      throw new TypeError(
        'Event values must be an EventListener, EventListenerObject, null or undefined.',
      );
    }
    if (
      oldValue == null ||
      newValue == null ||
      !areEventListenerOptionsEqual(
        newValue,
        oldValue as EventListenerOrEventListenerObject,
      )
    ) {
      if (oldValue != null) {
        this._node.removeEventListener(this._name, this, oldValue);
      }
      if (newValue != null) {
        this._node.addEventListener(this._name, this, newValue);
      }
    }
  }
}

export class LivePart extends DOMPart<Element> {
  private readonly _name: string;

  constructor(node: Element, name: string) {
    super(node);
    this._name = name;
  }

  protected override _needsUpdate(
    _oldValue: unknown,
    _newValue: unknown,
  ): boolean {
    return true;
  }

  protected _update(_oldValue: unknown, newValue: unknown): void {
    if ((this._node as any)[this._name] !== newValue) {
      (this._node as any)[this._name] = newValue;
    }
  }
}

export class PropertyPart extends DOMPart<Element> {
  private readonly _name: string;

  constructor(node: Element, name: string) {
    super(node);
    this._name = name;
  }

  protected _update(_oldValue: unknown, newValue: unknown): void {
    (this._node as any)[this._name] = newValue;
  }
}

function areEventListenerOptionsEqual(
  newListener: EventListenerOrEventListenerObject,
  oldListener: EventListenerOrEventListenerObject,
): boolean {
  return sequentialEqual(
    getEventListenerOptions(newListener),
    getEventListenerOptions(oldListener),
  );
}

function getEventListenerOptions(
  listener: EventListenerOrEventListenerObject,
): unknown[] {
  const { capture, once, passive, signal } =
    listener as AddEventListenerOptions;
  return [capture, once, passive, signal];
}

function isEventListenerOrNullable(
  value: any,
): value is EventListenerOrEventListenerObject & AddEventListenerOptions {
  return (
    value == null ||
    typeof value === 'function' ||
    typeof value.handleEvent === 'function'
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

function toStringOrEmpty(value: unknown): string {
  return value?.toString?.() ?? '';
}

function toggleClass(
  classList: DOMTokenList,
  component: string,
  enabled: boolean,
): void {
  for (const token of component.trim().split(CLASS_TOKEN_SEPARATOR_PATTERN)) {
    if (token !== '') {
      classList.toggle(token, enabled);
    }
  }
}

function updateClass(
  classList: DOMTokenList,
  oldTokens: ClassMap,
  newTokens: ClassMap,
): void {
  for (const component of Object.keys(oldTokens)) {
    if (!Object.hasOwn(newTokens, component)) {
      toggleClass(classList, component, false);
    }
  }

  for (const component of Object.keys(newTokens)) {
    toggleClass(classList, component, newTokens[component]!);
  }
}

function updateStyle(
  style: CSSStyleDeclaration,
  oldProps: StyleMap,
  newProps: StyleMap,
): void {
  for (const key of Object.keys(oldProps)) {
    if (
      oldProps[key] != null &&
      (!Object.hasOwn(newProps, key) || newProps[key] == null)
    ) {
      const name = toCSSPropertyName(key);
      style.removeProperty(name);
    }
  }

  for (const key of Object.keys(newProps)) {
    const value = newProps[key];
    if (value != null) {
      const name = toCSSPropertyName(key);
      style.setProperty(name, value);
    }
  }
}
