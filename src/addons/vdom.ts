import { shallowEqual } from '../compare.js';
import {
  type Bindable,
  type Binding,
  Directive,
  type DirectiveContext,
  type DirectiveType,
  isBindable,
  PART_TYPE_ELEMENT,
  type Part,
  type Session,
} from '../core.js';
import { ensurePartType } from '../dom.js';
import { BlackholeType } from '../primitive/blackhole.js';
import { Repeat } from '../primitive/repeat.js';
import { type StyleMap, updateStyles } from '../primitive/style.js';
import type { Component } from '../render-context.js';
import { ChildNodeTemplate } from '../template/child-node.js';
import { ElementTemplate } from '../template/element.js';
import { EmptyTemplate } from '../template/empty.js';
import { FragmentTemplate } from '../template/fragment.js';
import type { Template } from '../template/template.js';
import { TextTemplate } from '../template/text.js';

const $cleanup = Symbol('$cleanup');

export type VNode =
  | readonly VNode[]
  | VElement
  | Bindable
  | bigint
  | boolean
  | number
  | string
  | symbol
  | null
  | undefined;

export type VElementType<TProps> = Component<TProps> | string;

export type Ref<T> =
  | { current: T }
  | ((current: T) => Cleanup | void)
  | null
  | undefined;

type ElementProps = Record<string, unknown>;

type NormalizeProps<TProps> = { children: VNode[] } & Omit<TProps, 'key'>;

type EventListenerWithOptions =
  | EventListener
  | (EventListenerObject & AddEventListenerOptions);

type Cleanup = () => void;

interface HasCleanup {
  [$cleanup]?: Cleanup | void;
}

type TemplateDirective<TExprs extends readonly unknown[]> = Directive<
  Template<TExprs>,
  TExprs
>;

/**
 * @internal
 */
export abstract class ElementType {
  static resolveBinding(
    props: ElementProps,
    part: Part,
    _context: DirectiveContext,
  ): ElementBinding {
    ensurePartType(PART_TYPE_ELEMENT, this, props, part);
    return new ElementBinding(props, part);
  }
}

export function createElement<TProps extends {}>(
  type: string,
  props?: TProps,
  ...children: VNode[]
): VElement<NormalizeProps<TProps>>;
export function createElement<TProps extends {}>(
  type: Component<NormalizeProps<TProps>>,
  props: TProps,
  ...children: VNode[]
): VElement<NormalizeProps<TProps>>;
export function createElement<TProps extends {}>(
  type: VElementType<NormalizeProps<TProps>>,
  props: TProps & { key?: unknown } = {} as TProps,
  ...children: VNode[]
): VElement<NormalizeProps<TProps>> {
  const { key, ...restProps } = props;
  return new VElement(type, { children, ...restProps }, key, true);
}

export function Fragment(children: VNode[]): VStaticFragment {
  return new VStaticFragment(children);
}

export class VElement<TProps extends {} = {}> implements Bindable {
  readonly type: VElementType<TProps>;

  readonly props: TProps;

  readonly key: unknown;

  readonly hasStaticChildren: boolean;

  constructor(
    type: VElementType<TProps>,
    props: TProps,
    key?: unknown,
    hasStaticChildren = false,
  ) {
    this.type = type;
    this.props = props;
    this.key = key;
    this.hasStaticChildren = hasStaticChildren;
    DEBUG: {
      Object.freeze(this);
    }
  }

  [Directive.toDirective](): Directive.Element<unknown> {
    return typeof this.type === 'function'
      ? new Directive(this.type, this.props, this.key)
      : resolveVElement(
          this.type,
          this.props,
          this.key,
          this.hasStaticChildren,
        );
  }
}

export class VFragment implements Bindable<Directive.Element<unknown>> {
  readonly children: readonly VNode[];

  readonly key: unknown;

  constructor(children: readonly VNode[], key?: unknown) {
    this.children = children;
    this.key = key;
    DEBUG: {
      Object.freeze(this);
    }
  }

  [Directive.toDirective](): Directive.Element<unknown> {
    return new Directive(Repeat, this.children.map(resolveVChild), this.key);
  }
}

export class VStaticFragment implements Bindable {
  readonly children: readonly VNode[];

  readonly key: unknown;

  constructor(children: readonly VNode[], key?: unknown) {
    this.children = children;
    this.key = key;
    DEBUG: {
      Object.freeze(this);
    }
  }

  [Directive.toDirective](): Directive.Element<unknown> {
    const templates: Template<readonly unknown[]>[] = [];
    const exprs: unknown[] = [];

    for (const child of this.children) {
      if (child instanceof VElement) {
        if (typeof child.type === 'function') {
          templates.push(ChildNodeTemplate.Default);
          exprs.push(child);
        } else {
          const { type, value } = resolveVElement(
            child.type,
            child.props,
            child.key,
            child.hasStaticChildren,
          );
          templates.push(type);
          exprs.push(value[0], value[1]);
        }
      } else if (isBindable(child)) {
        templates.push(ChildNodeTemplate.Default);
        exprs.push(child);
      } else if (Array.isArray(child)) {
        templates.push(ChildNodeTemplate.Default);
        exprs.push(new VFragment(child));
      } else if (child == null || typeof child === 'boolean') {
        templates.push(EmptyTemplate.Default);
      } else {
        templates.push(TextTemplate.Default);
        exprs.push(child);
      }
    }

    return new Directive(new FragmentTemplate(templates), exprs, this.key);
  }
}

/**
 * @internal
 */
export class ElementBinding implements Binding<ElementProps, Part.ElementPart> {
  private _pendingProps: ElementProps;

  private _currentProps: ElementProps | null = null;

  private readonly _part: Part.ElementPart;

  private readonly _eventListenerMap: Map<string, EventListenerWithOptions> =
    new Map();

  constructor(props: ElementProps, part: Part.ElementPart) {
    this._pendingProps = props;
    this._part = part;
  }

  get type(): DirectiveType<ElementProps> {
    return ElementType;
  }

  get value(): ElementProps {
    return this._pendingProps;
  }

  set value(props: ElementProps) {
    this._pendingProps = props;
  }

  get part(): Part.ElementPart {
    return this._part;
  }

  shouldUpdate(value: ElementProps): boolean {
    return (
      this._currentProps === null || !shallowEqual(this._currentProps, value)
    );
  }

  attach(_session: Session): void {}

  detach(_session: Session): void {}

  commit(): void {
    const newProps = this._pendingProps;
    const oldProps = this._currentProps ?? ({} as ElementProps);
    const element = this._part.node;

    for (const key of Object.keys(oldProps)) {
      if (!Object.hasOwn(newProps, key)) {
        this._deleteProperty(
          element,
          key,
          oldProps[key as keyof ElementProps]!,
        );
      }
    }

    for (const key of Object.keys(newProps)) {
      this._updateProperty(
        element,
        key,
        newProps[key as keyof ElementProps],
        oldProps[key as keyof ElementProps],
      );
    }

    this._currentProps = newProps;
  }

  rollback(): void {
    const props = this._currentProps;

    if (props !== null) {
      const element = this._part.node;
      for (const key of Object.keys(props)) {
        this._deleteProperty(element, key, props[key as keyof ElementProps]);
      }
    }

    this._currentProps = null;
  }

  handleEvent(event: Event): void {
    const listener = this._eventListenerMap.get(event.type);

    if (typeof listener === 'function') {
      listener(event);
    } else {
      listener?.handleEvent(event);
    }
  }

  private _addEventListener(
    type: string,
    listener: EventListenerWithOptions,
  ): void {
    if (typeof listener === 'function') {
      this._part.node.addEventListener(type, this);
    } else {
      this._part.node.addEventListener(type, this, listener);
    }
  }

  private _deleteProperty(element: Element, key: string, value: unknown): void {
    switch (key) {
      case 'children':
      case 'key':
        // Skip reserved properties.
        return;
      case 'className':
      case 'innerHTML':
      case 'textContent':
        element[key] = '';
        return;
      case 'checked':
        if (narrowElement(element, 'input')) {
          element.checked = false;
          return;
        }
        break;
      case 'defaultChecked':
        if (narrowElement(element, 'input')) {
          element.defaultChecked = false;
          return;
        }
        break;
      case 'defaultValue':
        if (narrowElement(element, 'input', 'output', 'textarea')) {
          element.defaultValue = '';
          return;
        }
        break;
      case 'htmlFor':
        if (narrowElement(element, 'label')) {
          element.htmlFor = '';
          return;
        }
        break;
      case 'ref':
        if (value != null) {
          cleanupRef(value as NonNullable<Ref<Element | null>>, element);
        }
        return;
      case 'style':
        updateStyles(
          (element as HTMLElement).style,
          {},
          (value ?? {}) as StyleMap,
        );
        return;
      case 'value':
        if (narrowElement(element, 'input', 'output', 'select', 'textarea')) {
          element.value = '';
        }
        break;
      default:
        if (key.length > 2 && key.startsWith('on')) {
          const type = key.slice(2).toLowerCase();
          this._removeEventListener(type, value as EventListenerWithOptions);
          this._eventListenerMap.delete(type);
          return;
        }
    }

    element.removeAttribute(key);
  }

  private _removeEventListener(
    type: string,
    listener: EventListenerWithOptions,
  ): void {
    if (typeof listener === 'function') {
      this._part.node.removeEventListener(type, this);
    } else {
      this._part.node.removeEventListener(type, this, listener);
    }
  }

  private _updateProperty(
    element: Element,
    key: string,
    newValue: unknown,
    oldValue: unknown,
  ): void {
    switch (key) {
      case 'children':
      case 'key':
        // Skip reserved properties.
        return;
      case 'className':
      case 'innerHTML':
      case 'textContent':
        if (!Object.is(newValue, oldValue)) {
          element[key] = toStringOrEmpty(newValue);
        }
        return;
      case 'checked':
        if (narrowElement(element, 'input')) {
          const newChecked = !!newValue;
          const oldChecked = element.checked;
          if (newChecked !== oldChecked) {
            element.checked = newChecked;
          }
          return;
        }
        break;
      case 'defaultChecked':
        if (narrowElement(element, 'input')) {
          if (!Object.is(newValue, oldValue)) {
            element.defaultChecked = !!newValue;
          }
          return;
        }
        break;
      case 'defaultValue':
        if (narrowElement(element, 'input', 'output', 'textarea')) {
          if (!Object.is(newValue, oldValue)) {
            element.defaultValue = toStringOrEmpty(newValue);
          }
          return;
        }
        break;
      case 'htmlFor':
        if (narrowElement(element, 'label')) {
          if (!Object.is(newValue, oldValue)) {
            element.htmlFor = toStringOrEmpty(newValue);
          }
          return;
        }
        break;
      case 'ref':
        if (newValue !== oldValue) {
          if (oldValue != null) {
            cleanupRef(oldValue as NonNullable<Ref<Element | null>>, element);
          }
          if (newValue != null) {
            invokeRef(newValue as NonNullable<Ref<Element | null>>, element);
          }
        }
        return;
      case 'style':
        if (!isNullableObject(newValue) || !isNullableObject(oldValue)) {
          throw new Error(
            'The "style" property expects a object, not a string.',
          );
        }
        updateStyles(
          (element as HTMLElement).style,
          (newValue ?? {}) as StyleMap,
          (oldValue ?? {}) as StyleMap,
        );
        return;
      case 'value':
        if (narrowElement(element, 'input', 'output', 'select', 'textarea')) {
          const newString = toStringOrEmpty(newValue);
          const oldString = element.value;
          if (newString !== oldString) {
            element.value = newString;
          }
          return;
        }
        break;
      default:
        if (key.length > 2 && key.startsWith('on')) {
          const type = key.slice(2).toLowerCase();
          if (
            typeof newValue === 'object' ||
            typeof oldValue === 'object' ||
            newValue === undefined ||
            oldValue === undefined
          ) {
            if (oldValue != null) {
              this._removeEventListener(
                type,
                oldValue as EventListenerWithOptions,
              );
            }
            if (newValue != null) {
              this._addEventListener(
                type,
                newValue as EventListenerWithOptions,
              );
            }
          }
          this._eventListenerMap.set(
            type,
            newValue as EventListenerWithOptions,
          );
          return;
        }
    }

    if (!Object.is(newValue, oldValue)) {
      switch (typeof newValue) {
        case 'string':
          element.setAttribute(key, newValue);
          break;
        case 'boolean':
          element.toggleAttribute(key, newValue);
          break;
        default:
          if (newValue == null) {
            element.removeAttribute(key);
          } else {
            element.setAttribute(key, newValue.toString());
          }
      }
    }
  }
}

function cleanupRef(
  ref: NonNullable<Ref<Element | null>>,
  element: Element & HasCleanup,
): void {
  if (typeof ref === 'function') {
    element[$cleanup]?.();
    element[$cleanup] = undefined;
  } else {
    ref.current = null;
  }
}

function invokeRef(
  ref: NonNullable<Ref<Element | null>>,
  element: Element & HasCleanup,
): void {
  if (typeof ref === 'function') {
    element[$cleanup] = ref(element);
  } else {
    ref.current = element;
  }
}

function isNullableObject(value: unknown): value is object | null | undefined {
  return typeof value === 'object' || value === undefined;
}

function narrowElement<const TName extends keyof HTMLElementTagNameMap>(
  element: Element,
  ...expectedNames: TName[]
): element is HTMLElementTagNameMap[Lowercase<TName>] {
  return (expectedNames as string[]).includes(element.localName);
}

function resolveVChild(child: VNode): Bindable {
  if (isBindable(child)) {
    return child;
  } else if (Array.isArray(child)) {
    return new VFragment(child);
  } else if (child == null || typeof child === 'boolean') {
    return new Directive(BlackholeType, child);
  } else {
    return new Directive(TextTemplate.Default, [child]);
  }
}

function resolveVElement(
  type: string,
  props: { children?: unknown },
  key: unknown,
  hasStaticChildren: boolean,
): TemplateDirective<readonly [unknown, unknown]> {
  const element = new Directive(ElementType, props);
  const children = Array.isArray(props.children)
    ? hasStaticChildren
      ? new VStaticFragment(props.children)
      : new VFragment(props.children)
    : resolveVChild(props.children as VNode);
  const template = new ElementTemplate(type);
  const exprs = [element, children] as const;
  return new Directive(template, exprs, key);
}

function toStringOrEmpty(value: unknown): string {
  return value?.toString() ?? '';
}
