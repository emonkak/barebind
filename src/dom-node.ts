import { sequentialEqual } from './compare.js';
import type { HostNode, VHostElement, VPrimitive, VTemplate } from './core.js';

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
  _parent: DOMNode | null = null;

  get firstNode(): ChildNode | null {
    return null;
  }

  get lastNode(): ChildNode | null {
    return null;
  }

  get bindValue(): unknown {
    return null;
  }

  get ref(): unknown {
    return null;
  }

  prepareUpdate(
    _type: VHostElement['type'],
    oldProps: VHostElement['props'],
    newProps: VHostElement['props'],
  ): boolean {
    return oldProps !== newProps;
  }

  appendChild(_child: DOMNode, _after: DOMNode | null): void {}

  moveChild(_child: DOMNode, _after: DOMNode | null): void {}

  removeChild(child: DOMNode): void {
    child._remove();
    child._parent = null;
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

  _remove(): void {}

  _mountBefore(_afterNode: ChildNode): void {}

  _moveBefore(_afterNode: ChildNode): void {}

  _invalidate(_child: DOMNode): void {
    this._parent?._invalidate(this);
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
    this._update(this._value, newValue);
    this._value = newValue;
  }

  protected abstract _update(oldValue: unknown, newValue: unknown): void;
}

export class DOMBind extends DOMNode {
  private readonly _index: number;

  private _child: DOMNode | null = null;

  constructor(index: number) {
    super();
    this._index = index;
  }

  get index(): number {
    return this._index;
  }

  override get ref(): unknown {
    return this._parent instanceof DOMBlock
      ? (this._parent.parts[this._index]!.node ?? null)
      : null;
  }

  override get bindValue(): unknown {
    return this._child?.bindValue;
  }

  override appendChild(child: DOMNode, _after: DOMNode | null): void {
    child._parent = this;
    this._child = child;
  }

  override moveChild(child: DOMNode, after: DOMNode | null): void {
    const part =
      this._parent instanceof DOMBlock
        ? (this._parent.parts[this._index]! ?? null)
        : null;
    if (part !== null) {
      child._moveBefore(after?.firstNode ?? part.node);
    }
  }

  override removeChild(child: DOMNode): void {
    super.removeChild(child);
    this._child = null;
  }
}

export class DOMBlock extends DOMNode {
  private readonly _fragment: DocumentFragment;

  private readonly _childNodes: ChildNode[];

  private readonly _parts: DOMPart[];

  private readonly _binds: (DOMBind | undefined)[];

  constructor(fragment: DocumentFragment, parts: DOMPart[]) {
    super();
    this._fragment = fragment;
    this._childNodes = Array.from(fragment.childNodes);
    this._parts = parts;
    this._binds = new Array(parts.length);
  }

  get parts(): DOMPart[] {
    return this._parts;
  }

  override get ref(): ChildNode[] {
    return collectChildNodes(this.firstNode, this.lastNode);
  }

  override get firstNode(): ChildNode | null {
    return this._childNodes[0] ?? null;
  }

  override get lastNode(): ChildNode | null {
    return this._childNodes.at(-1) ?? null;
  }

  override get bindValue(): unknown {
    return this;
  }

  override appendChild(child: DOMNode, _after: DOMNode | null): void {
    if (child instanceof DOMBind) {
      this._binds[child.index] = child;
      child._parent = this;
    }
  }

  override removeChild(child: DOMNode): void {
    super.removeChild(child);
    if (child instanceof DOMBind) {
      this._binds[child.index] = undefined;
      child._parent = null;
    }
  }

  override commitMount(
    _type: VTemplate['type'],
    _props: VTemplate['props'],
  ): void {
    for (const bind of this._binds) {
      if (bind !== undefined) {
        this._parts[bind.index]!.value = bind?.bindValue;
      }
    }
  }

  override commitUpdate(
    _type: VTemplate['type'],
    _oldElement: VTemplate['props'],
    _newElement: VTemplate['props'],
  ): void {
    for (const bind of this._binds) {
      if (bind !== undefined) {
        this._parts[bind.index]!.value = bind.bindValue;
      }
    }
  }

  override _mountBefore(afterNode: ChildNode): void {
    afterNode.before(this._fragment);
  }

  override _moveBefore(afterNode: ChildNode): void {
    for (const node of collectChildNodes(this.firstNode, this.lastNode)) {
      moveBefore.call(afterNode.parentNode, node, afterNode);
    }
  }

  override _remove(): void {
    this._fragment.append(...collectChildNodes(this.firstNode, this.lastNode));
    this._parent = null;
  }

  override _invalidate(child: DOMNode): void {
    if (child instanceof DOMBind) {
      this._parts[child.index]!.value = child.bindValue;
    }
  }
}

export class DOMPortal extends DOMNode {
  private _container: Element;

  constructor(container: Element) {
    super();
    this._container = container;
  }

  override get ref(): Element {
    return this._container;
  }

  override get firstNode(): Element {
    return this._container;
  }

  override get lastNode(): Element {
    return this._container;
  }

  override appendChild(child: DOMNode, after: DOMNode | null): void {
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

  override get bindValue(): unknown {
    return this._value;
  }

  override get ref(): unknown {
    return this._parent?.ref;
  }

  override prepareUpdate(
    _type: VPrimitive['type'],
    oldProps: VPrimitive['props'],
    newProps: VPrimitive['props'],
  ): boolean {
    return !Object.is(oldProps.value, newProps.value);
  }

  override commitUpdate(
    _type: VPrimitive['type'],
    _oldProps: VPrimitive['props'],
    newProps: VPrimitive['props'],
  ): void {
    this._value = newProps.value;
    this._invalidate(this);
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
      let oldTokens = oldValue;
      if (!isObject(oldTokens)) {
        this._node.className = '';
        oldTokens = {};
      }
      updateClass(
        this._node.classList,
        oldTokens as ClassMap,
        newValue as ClassMap,
      );
    } else if (this._name === 'style' && isObject(newValue)) {
      let oldProps = oldValue;
      if (!isObject(oldProps)) {
        (this._node as HTMLElement).style = '';
        oldProps = {};
      }
      updateStyle(
        (this._node as HTMLElement).style,
        oldProps as StyleMap,
        newValue as StyleMap,
      );
    } else if (newValue == null) {
      this._node.removeAttribute(this._name);
    } else if (typeof newValue === 'boolean') {
      this._node.toggleAttribute(this._name, newValue);
    } else {
      this._node.setAttribute(this._name, newValue?.toString?.() ?? '');
    }
  }
}

export class ChildNodePart extends DOMPart<Comment> {
  constructor(node: Comment) {
    super(node);
  }

  protected _update(oldValue: unknown, newValue: unknown): void {
    if (oldValue !== newValue) {
      if (oldValue instanceof DOMNode) {
        oldValue._remove();
      } else {
        this._node.data = '';
      }
      if (newValue instanceof DOMNode) {
        newValue._mountBefore(this._node);
      } else {
        this._node.data = toStringOrEmpty(newValue);
      }
    }
  }
}

export class ElementPart extends DOMPart<Element> {
  constructor(node: Element) {
    super(node);
  }

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
    if (!isEventListenerOrNillish(newValue)) {
      throw new Error(
        'Event values must be an EventListener, EventListenerObject, null or undefined.',
      );
    }
    if (
      oldValue == null ||
      newValue == null ||
      !compareEventListenerOptions(
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

  protected _update(newValue: unknown): void {
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
  constructor(node: Text) {
    super(node);
  }

  protected _update(_oldValue: unknown, newValue: unknown): void {
    this._node.data = toStringOrEmpty(newValue);
  }
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

function compareEventListenerOptions(
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

function isEventListenerOrNillish(
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
