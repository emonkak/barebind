import { sequentialEqual } from '../compare.js';
import type { HostNode, VHostElement, VPrimitive } from '../core.js';

const CLASS_TOKEN_SEPARATOR_PATTERN = /\s+/;

const CSS_UPPERCASE_LETTER_PATTERN = /[A-Z]/g;
const CSS_VENDOR_PREFIX_PATTERN = /^(webkit|moz|ms|o)(?=[A-Z])/;

const insertBefore = Element.prototype.insertBefore;
const moveBefore =
  /* v8 ignore next */
  Element.prototype.moveBefore ?? Element.prototype.insertBefore;

interface ClassMap {
  readonly [key: string]: boolean;
}

interface StyleMap {
  readonly [key: string]: string | null | undefined;
}

export abstract class DOMNode implements HostNode {
  /** @internal */
  _parent: DOMNode | null = null;
  /** @internal */
  _children: Set<DOMNode> = new Set();

  get firstNode(): ChildNode | null {
    return null;
  }

  get lastNode(): ChildNode | null {
    return null;
  }

  get refNode(): unknown {
    return undefined;
  }

  get value(): unknown {
    return null;
  }

  appendChild(child: DOMNode, _after: DOMNode | null): void {
    this._children.add(child);
    child._parent = this;
  }

  commitMount(
    _type: VHostElement['type'],
    _props: VHostElement['props'],
  ): void {}

  commitUpdate(
    _type: VHostElement['type'],
    _oldProps: VHostElement['props'],
    _newProps: VHostElement['props'],
  ): void {}

  moveChild(_child: DOMNode, _after: DOMNode | null): void {}

  removeChild(child: DOMNode): void {
    this._children.delete(child);
    child._remove();
    child._parent = null;
  }

  /**
   * @internal
   */
  _invalidate(_child: DOMNode): void {}

  /**
   * @internal
   */
  _mountBefore(_afterNode: ChildNode): void {}

  /**
   * @internal
   */
  _moveBefore(_afterNode: ChildNode): void {}

  /**
   * @internal
   */
  _remove(): void {
    for (const child of this._children) {
      child._remove();
    }
  }
}

export abstract class DOMPart<TNode extends ChildNode = ChildNode> {
  protected readonly _node: TNode;

  protected _value: unknown;

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
      this._value = newValue;
    }
  }

  protected _needsUpdate(oldValue: unknown, newValue: unknown): boolean {
    return !Object.is(oldValue, newValue);
  }

  protected abstract _update(oldValue: unknown, newValue: unknown): void;
}

export class DOMBind extends DOMNode {
  private readonly _index: number;

  constructor(index: number) {
    super();
    this._index = index;
  }

  get index(): number {
    return this._index;
  }

  override get refNode(): unknown {
    return this._getPart()?.node;
  }

  override appendChild(child: DOMNode, after: DOMNode | null): void {
    super.appendChild(child, after);
    const part = this._getPart();
    if (part !== undefined) {
      child._mountBefore(after?.firstNode ?? part.node);
      part.value = child.value;
    }
  }

  override moveChild(child: DOMNode, after: DOMNode | null): void {
    const part = this._getPart();
    if (part !== undefined) {
      child._moveBefore(after?.firstNode ?? part.node);
    }
  }

  /**
   * @internal
   */
  override _invalidate(child: DOMNode): void {
    const part = this._getPart();
    if (part !== undefined) {
      part.value = child.value;
    }
  }

  private _getPart(): DOMPart | undefined {
    return this._parent instanceof DOMBlock
      ? this._parent._parts[this._index]
      : undefined;
  }
}

export class DOMBlock extends DOMNode {
  readonly _fragment: DocumentFragment;

  readonly _staticNodes: ChildNode[];

  readonly _parts: DOMPart[];

  constructor(fragment: DocumentFragment, parts: DOMPart[]) {
    super();
    this._fragment = fragment;
    this._staticNodes = Array.from(fragment.childNodes);
    this._parts = parts;
  }

  override get firstNode(): ChildNode | null {
    return this._staticNodes[0] ?? null;
  }

  override get lastNode(): ChildNode | null {
    return this._staticNodes.at(-1) ?? null;
  }

  override get refNode(): ChildNode[] {
    return collectChildNodes(this.firstNode, this.lastNode);
  }

  override commitMount(
    _type: VHostElement['type'],
    _props: VHostElement['props'],
  ): void {
    for (const child of this._children) {
      if (child instanceof DOMBind) {
        const part = this._parts[child.index];
        if (part !== undefined) {
          for (const descendant of child._children) {
            descendant._mountBefore(part.node);
            part.value = descendant.value;
          }
        }
      }
    }
  }

  /**
   * @internal
   */
  override _mountBefore(afterNode: ChildNode): void {
    afterNode.before(this._fragment);
  }

  /**
   * @internal
   */
  override _moveBefore(afterNode: ChildNode): void {
    for (const node of collectChildNodes(this.firstNode, this.lastNode)) {
      moveBefore.call(afterNode.parentNode, node, afterNode);
    }
  }

  /**
   * @internal
   */
  override _remove(): void {
    for (const node of collectChildNodes(this.firstNode, this.lastNode)) {
      node.remove();
    }
    this._fragment.replaceChildren(...this._staticNodes);
    this._parent = null;
  }
}

export class DOMPortal extends DOMNode {
  private _container: Element;

  constructor(container: Element) {
    super();
    this._container = container;
  }

  override get firstNode(): Element {
    return this._container;
  }

  override get lastNode(): Element {
    return this._container;
  }

  override get refNode(): Element {
    return this._container;
  }

  override appendChild(child: DOMNode, after: DOMNode | null): void {
    super.appendChild(child, after);
    for (const node of collectChildNodes(child.firstNode, child.lastNode)) {
      insertBefore.call(this._container, node, after?.firstNode ?? null);
    }
  }

  override moveChild(child: DOMNode, after: DOMNode | null): void {
    for (const node of collectChildNodes(child.firstNode, child.lastNode)) {
      moveBefore.call(this._container, node, after?.firstNode ?? null);
    }
  }
}

export class DOMPrimitive extends DOMNode {
  private _value: unknown;

  constructor(value: unknown) {
    super();
    this._value = value;
  }

  override get value(): unknown {
    return this._value;
  }

  override commitUpdate(
    _type: VPrimitive['type'],
    _oldProps: VPrimitive['props'],
    newProps: VPrimitive['props'],
  ): void {
    this._value = newProps.value;
    this._parent?._invalidate(this);
  }
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

export class ChildNodePart extends DOMPart<Comment> {
  protected _update(_oldValue: unknown, newValue: unknown): void {
    this._node.data = toStringOrEmpty(newValue);
  }
}

export class ElementPart extends DOMPart<Element> {
  protected _update(_newValue: unknown): void {}
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

export class TextPart extends DOMPart<Text> {
  protected _update(_oldValue: unknown, newValue: unknown): void {
    this._node.data = toStringOrEmpty(newValue);
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

function collectChildNodes(
  firstNode: ChildNode | null,
  lastNode: ChildNode | null,
): ChildNode[] {
  const childNodes = [];

  for (
    let currentNode = firstNode;
    currentNode !== null;
    currentNode = currentNode.nextSibling
  ) {
    childNodes.push(currentNode);
    if (currentNode === lastNode) {
      break;
    }
  }

  return childNodes;
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
