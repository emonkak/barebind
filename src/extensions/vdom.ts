import { shallowEqual } from '../compare.js';
import { type ComponentFunction, FunctionComponent } from '../component.js';
import {
  $toDirective,
  type Bindable,
  type Binding,
  type CommitContext,
  type Directive,
  type DirectiveContext,
  type DirectiveType,
  type HydrationTree,
  isBindable,
  type Part,
  PartType,
  type Template,
  type UpdateContext,
} from '../core.js';
import { debugPart } from '../debug/part.js';
import { markUsedValue } from '../debug/value.js';
import { DirectiveSpecifier } from '../directive.js';
import { BlackholePrimitive } from '../primitive/blackhole.js';
import {
  deleteStyles,
  type StyleProperties,
  updateStyles,
} from '../primitive/style.js';
import { RepeatDirective, type RepeatProps } from '../repeat.js';
import { ChildNodeTemplate } from '../template/child-node.js';
import { ElementTemplate } from '../template/element.js';
import { EmptyTemplate } from '../template/empty.js';
import { FragmentTemplate } from '../template/fragment.js';
import { TextTemplate } from '../template/text.js';

const $cleanup = Symbol('$cleanup');

const CHILD_NODE_TEMPLATE = new ChildNodeTemplate();
const EMPTY_TEMPLATE = new EmptyTemplate();
const TEXT_TEMPLATE = new TextTemplate();

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

export type VElementType<TProps> = ComponentFunction<TProps> | string;

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

interface TemplateSpecifier<TBinds extends readonly unknown[]> {
  type: Template<TBinds>;
  value: TBinds;
}

/**
 * @internal
 */
export const ElementDirective: DirectiveType<ElementProps> = {
  name: 'ElementDirective',
  resolveBinding(
    props: {},
    part: Part,
    _context: DirectiveContext,
  ): ElementBinding {
    if (part.type !== PartType.Element) {
      throw new Error(
        'ElementDirective must be used in an element part, but it is used here:\n' +
          debugPart(part, markUsedValue(new DirectiveSpecifier(this, props))),
      );
    }
    return new ElementBinding(props, part);
  },
};

export function createElement<TProps extends {}>(
  type: string,
  props?: TProps,
  ...children: VNode[]
): VElement<NormalizeProps<TProps>>;
export function createElement<TProps extends {}>(
  type: ComponentFunction<NormalizeProps<TProps>>,
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

export function createFragment(children: VNode[]): VStaticFragment {
  return new VStaticFragment(children);
}

export class VElement<TProps extends {} = {}> implements Bindable<unknown> {
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
  }

  [$toDirective](): Directive<unknown> {
    if (typeof this.type === 'function') {
      return {
        type: new FunctionComponent(this.type),
        value: this.props,
      };
    } else {
      return resolveElement(this.type, this.props, this.hasStaticChildren);
    }
  }
}

export class VFragment implements Bindable<RepeatProps<VNode>> {
  readonly children: readonly VNode[];

  constructor(children: readonly VNode[]) {
    this.children = children;
  }

  [$toDirective](): Directive<RepeatProps<VNode>> {
    return {
      type: RepeatDirective,
      value: {
        source: this.children,
        keySelector: resolveKey,
        valueSelector: resolveChild,
      },
    };
  }
}

export class VStaticFragment implements Bindable<unknown> {
  readonly children: readonly VNode[];

  constructor(children: readonly VNode[]) {
    this.children = children;
  }

  [$toDirective](): Directive<unknown> {
    const templates: Template<readonly unknown[]>[] = [];
    const binds: unknown[] = [];

    for (let i = 0, l = this.children.length; i < l; i++) {
      const child = this.children[i]!;
      if (child instanceof VElement) {
        if (typeof child.type === 'function') {
          templates.push(CHILD_NODE_TEMPLATE);
          binds.push(child);
        } else {
          const { type, value } = resolveElement(
            child.type,
            child.props,
            child.hasStaticChildren,
          );
          templates.push(type);
          binds.push(value[0], value[1]);
        }
      } else if (isBindable(child)) {
        templates.push(CHILD_NODE_TEMPLATE);
        binds.push(child);
      } else if (Array.isArray(child)) {
        templates.push(CHILD_NODE_TEMPLATE);
        binds.push(new VFragment(child));
      } else if (child == null || typeof child === 'boolean') {
        templates.push(EMPTY_TEMPLATE);
      } else {
        templates.push(TEXT_TEMPLATE);
        binds.push(child);
      }
    }

    return { type: new FragmentTemplate(templates), value: binds };
  }
}

/**
 * @internal
 */
export class ElementBinding implements Binding<ElementProps> {
  private _pendingProps: ElementProps;

  private _memoizedProps: ElementProps | null = null;

  private readonly _part: Part.ElementPart;

  private readonly _listenerMap: Map<string, EventListenerWithOptions> =
    new Map();

  constructor(props: ElementProps, part: Part.ElementPart) {
    this._pendingProps = props;
    this._part = part;
  }

  get type(): DirectiveType<ElementProps> {
    return ElementDirective as DirectiveType<ElementProps>;
  }

  get value(): ElementProps {
    return this._pendingProps;
  }

  get part(): Part.ElementPart {
    return this._part;
  }

  shouldBind(props: ElementProps): boolean {
    return (
      this._memoizedProps === null || !shallowEqual(this._memoizedProps, props)
    );
  }

  bind(props: ElementProps): void {
    this._pendingProps = props;
  }

  hydrate(_targetTree: HydrationTree, _context: UpdateContext): void {}

  connect(_context: UpdateContext): void {}

  disconnect(_context: UpdateContext): void {}

  commit(_context: CommitContext): void {
    const newProps = this._pendingProps;
    const oldProps = this._memoizedProps ?? ({} as ElementProps);
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

    this._memoizedProps = newProps;
  }

  rollback(_context: CommitContext): void {
    const props = this._memoizedProps;
    const element = this._part.node;

    if (props !== null) {
      for (const key of Object.keys(props)) {
        this._deleteProperty(element, key, props[key as keyof ElementProps]);
      }
    }

    this._memoizedProps = null;
  }

  handleEvent(event: Event): void {
    const listener = this._listenerMap.get(event.type);

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
        deleteStyles(
          (element as HTMLElement).style,
          (value ?? {}) as StyleProperties,
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
          this._listenerMap.delete(type);
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
          element[key] = safeToString(newValue);
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
            element.defaultValue = safeToString(newValue);
          }
          return;
        }
        break;
      case 'htmlFor':
        if (narrowElement(element, 'label')) {
          if (!Object.is(newValue, oldValue)) {
            element.htmlFor = safeToString(newValue);
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
          (newValue ?? {}) as StyleProperties,
          (oldValue ?? {}) as StyleProperties,
        );
        return;
      case 'value':
        if (narrowElement(element, 'input', 'output', 'select', 'textarea')) {
          const newString = safeToString(newValue);
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
          this._listenerMap.set(type, newValue as EventListenerWithOptions);
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

function resolveChild(child: VNode): Bindable<unknown> {
  if (isBindable(child)) {
    return child;
  } else if (Array.isArray(child)) {
    return new VFragment(child);
  } else if (child == null || typeof child === 'boolean') {
    return new DirectiveSpecifier(BlackholePrimitive, child);
  } else {
    return new DirectiveSpecifier(TEXT_TEMPLATE, [child]);
  }
}

function resolveElement(
  type: string,
  props: { children?: unknown },
  hasStaticChildren: boolean,
): TemplateSpecifier<readonly [unknown, unknown]> {
  const element = new DirectiveSpecifier(ElementDirective, props);
  const children = Array.isArray(props.children)
    ? hasStaticChildren
      ? new VStaticFragment(props.children)
      : new VFragment(props.children)
    : resolveChild(props.children as VNode);
  return {
    type: new ElementTemplate(type),
    value: [element, children],
  };
}

function resolveKey(child: VNode, index: number): unknown {
  return child instanceof VElement ? (child.key ?? index) : index;
}

function safeToString(value: unknown): string {
  return value?.toString() ?? '';
}
