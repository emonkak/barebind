import { sequentialEqual } from '../compare.js';
import type { Block, Part } from '../core.js';

const CLASS_TOKEN_SEPARATOR_PATTERN = /\s+/;

const CSS_UPPERCASE_LETTER_PATTERN = /[A-Z]/g;
const CSS_VENDOR_PREFIX_PATTERN = /^(webkit|moz|ms|o)(?=[A-Z])/;

interface ClassMap {
  readonly [key: string]: boolean;
}

interface StyleMap {
  readonly [key: string]: string | null | undefined;
}

export abstract class DOMPart implements Part {
  mountBlock(_block: Block, _afterNode: ChildNode): void {}

  moveBlock(_block: Block, _afterNode: ChildNode): void {}

  unmountBlock(_block: Block, _recursive: boolean): void {}

  commitMount(_value: unknown): void {}

  commitUpdate(_oldValue: unknown, _newValue: unknown): void {}

  commitUnmount(_value: unknown): void {}
}

export class AttributePart extends DOMPart {
  protected readonly _node: Element;
  protected readonly _name: string;

  constructor(node: Element, name: string) {
    super();
    this._node = node;
    this._name = name;
  }

  override commitMount(value: unknown): void {
    if (value == null) {
      this._node.removeAttribute(this._name);
    } else if (typeof value === 'boolean') {
      this._node.toggleAttribute(this._name, value);
    } else {
      this._node.setAttribute(this._name, toStringOrEmpty(value));
    }
  }

  override commitUpdate(oldValue: unknown, newValue: unknown): void {
    if (!Object.is(oldValue, newValue)) {
      this.commitMount(newValue);
    }
  }
}

export class ChildNodePart extends DOMPart {
  private readonly _node: CharacterData;

  constructor(node: CharacterData) {
    super();
    this._node = node;
  }

  override mountBlock(block: Block, afterNode: ChildNode | null): void {
    block.mountBefore(afterNode ?? this._node);
  }

  override moveBlock(block: Block, afterNode: ChildNode | null): void {
    block.moveBefore(afterNode ?? this._node);
  }

  override unmountBlock(block: Block, recursive: boolean): void {
    if (!recursive) {
      block.unmount();
    }
  }

  override commitMount(value: unknown): void {
    this._node.data = toStringOrEmpty(value);
  }

  override commitUpdate(oldValue: unknown, newValue: unknown): void {
    if (!Object.is(oldValue, newValue)) {
      this.commitMount(newValue);
    }
  }
}

export class ClassAttributePart extends AttributePart {
  override commitMount(value: unknown): void {
    if (isObject(value)) {
      updateClass(this._node.classList, {}, value as ClassMap);
    } else {
      super.commitMount(value);
    }
  }

  override commitUpdate(oldValue: unknown, newValue: unknown): void {
    if (!Object.is(oldValue, newValue)) {
      if (isObject(newValue)) {
        if (!isObject(oldValue)) {
          this._node.className = '';
          oldValue = {};
        }
        updateClass(
          this._node.classList,
          oldValue as ClassMap,
          newValue as ClassMap,
        );
      } else {
        super.commitMount(newValue);
      }
    }
  }
}

export class ElementPart extends DOMPart {
  private readonly _node: Element;
  private _cleanup: (() => void) | void | undefined;

  constructor(node: Element) {
    super();
    this._node = node;
  }

  override commitMount(value: unknown): void {
    if (!(value == null || typeof value === 'function')) {
      throw new TypeError(
        'Element values must be an function, null or undefined.',
      );
    }
    this._cleanup?.();
    this._cleanup = (value as Function)?.(this._node);
  }

  override commitUpdate(oldValue: unknown, newValue: unknown): void {
    if (oldValue !== newValue) {
      this.commitMount(newValue);
    }
  }

  override commitUnmount(_value: unknown): void {
    this._cleanup?.();
    this._cleanup = undefined;
  }
}

export class EventPart extends DOMPart implements EventListenerObject {
  private readonly _node: Element;
  private readonly _name: string;
  private _currentListener:
    | EventListenerOrEventListenerObject
    | null
    | undefined;

  constructor(node: Element, name: string) {
    super();
    this._node = node;
    this._name = name;
  }

  override commitMount(value: unknown): void {
    if (!isEventListenerOrNullable(value)) {
      throw new TypeError(
        'Event values must be an EventListener, EventListenerObject, null or undefined.',
      );
    }
    const oldListener = this._currentListener;
    const newListener = value;
    if (
      oldListener == null ||
      newListener == null ||
      !areEventListenerOptionsEqual(oldListener, newListener)
    ) {
      if (oldListener != null) {
        this._node.removeEventListener(
          this._name,
          this,
          oldListener as AddEventListenerOptions,
        );
      }
      if (newListener != null) {
        this._node.addEventListener(
          this._name,
          this,
          newListener as AddEventListenerOptions,
        );
      }
    }
    this._currentListener = value;
  }

  override commitUpdate(oldValue: unknown, newValue: unknown): void {
    if (oldValue !== newValue) {
      this.commitMount(newValue);
    }
  }

  handleEvent(event: Event): void {
    const listener = this._currentListener;
    if (typeof listener === 'function') {
      listener(event);
    } else {
      listener?.handleEvent(event);
    }
  }
}

export class LivePart extends DOMPart {
  private readonly _node: Element;
  private readonly _name: string;

  constructor(node: Element, name: string) {
    super();
    this._node = node;
    this._name = name;
  }

  override commitMount(value: unknown): void {
    if ((this._node as any)[this._name] !== value) {
      (this._node as any)[this._name] = value;
    }
  }

  override commitUpdate(_oldValue: unknown, newValue: unknown): void {
    this.commitMount(newValue);
  }
}

export class PortalPart extends DOMPart {
  private readonly _container: ParentNode;

  constructor(container: ParentNode) {
    super();
    this._container = container;
  }

  override mountBlock(block: Block, afterNode: ChildNode | null): void {
    block.mountInto(this._container, afterNode);
  }

  override moveBlock(block: Block, afterNode: ChildNode | null): void {
    block.moveInto(this._container, afterNode);
  }

  override unmountBlock(block: Block, _recursive: boolean): void {
    block.unmount();
  }
}

export class PropertyPart extends DOMPart {
  private readonly _node: Element;
  private readonly _name: string;

  constructor(node: Element, name: string) {
    super();
    this._node = node;
    this._name = name;
  }

  override commitMount(value: unknown): void {
    (this._node as any)[this._name] = value;
  }

  override commitUpdate(oldValue: unknown, newValue: unknown): void {
    if (!Object.is(oldValue, newValue)) {
      this.commitMount(newValue);
    }
  }
}

export class StyleAttributePart extends AttributePart {
  override commitMount(value: unknown): void {
    if (isObject(value)) {
      updateStyle((this._node as HTMLElement).style, {}, value as StyleMap);
    } else {
      super.commitMount(value);
    }
  }

  override commitUpdate(oldValue: unknown, newValue: unknown): void {
    if (!Object.is(oldValue, newValue)) {
      if (isObject(newValue)) {
        if (!isObject(oldValue)) {
          (this._node as HTMLElement).style = '';
          oldValue = {};
        }
        updateStyle(
          (this._node as HTMLElement).style,
          oldValue as StyleMap,
          newValue as StyleMap,
        );
      } else {
        super.commitMount(newValue);
      }
    }
  }
}

export class TextPart extends DOMPart {
  private readonly _node: CharacterData;

  constructor(node: CharacterData) {
    super();
    this._node = node;
  }

  override commitMount(value: unknown): void {
    this._node.data = toStringOrEmpty(value);
  }

  override commitUpdate(oldValue: unknown, newValue: unknown): void {
    if (!Object.is(oldValue, newValue)) {
      this.commitMount(newValue);
    }
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
): value is EventListenerOrEventListenerObject {
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
