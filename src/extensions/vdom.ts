import { shallowEqual } from '../compare.js';
import { inspectPart, markUsedValue } from '../debug.js';
import type {
  Binding,
  CommitContext,
  DirectiveContext,
  DirectiveType,
  Template,
  UpdateContext,
} from '../directive.js';
import {
  $toDirective,
  type Bindable,
  type ComponentType,
  type Directive,
  DirectiveSpecifier,
  isBindable,
} from '../directive.js';
import type { HydrationTree } from '../hydration.js';
import { type ElementPart, type Part, PartType } from '../part.js';
import { BlackholePrimitive } from '../primitive/blackhole.js';
import {
  deleteStyles,
  type StyleProps,
  updateStyles,
} from '../primitive/style.js';
import { ChildNodeTemplate } from '../template/child-node-template.js';
import { ElementTemplate } from '../template/element-template.js';
import { EmptyTemplate } from '../template/empty-template.js';
import { FragmentTemplate } from '../template/fragment-template.js';
import { TextTemplate } from '../template/text-template.js';
import { FunctionComponent } from './component.js';
import { RepeatDirective, type RepeatProps } from './repeat.js';

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

export type VElementType<TProps> = ComponentType<TProps> | string;

export type ElementProps = Record<string, unknown> & { children?: unknown };

type NormalizeProps<TProps> = { children: VNode[] } & Omit<TProps, 'key'>;

type EventListenerWithOptions =
  | EventListener
  | (EventListenerObject & AddEventListenerOptions);

type Ref<T> =
  | { current: T }
  | ((current: T) => Cleanup | void)
  | null
  | undefined;

type Cleanup = () => void;

interface HasCleanup {
  [$cleanup]?: Cleanup | void;
}

export const ElementDirective: DirectiveType<ElementProps> = {
  displayName: 'ElementDirective',
  resolveBinding(
    props: ElementProps,
    part: Part,
    _context: DirectiveContext,
  ): ElementBinding {
    if (part.type !== PartType.Element) {
      throw new Error(
        'ElementDirective must be used in an element part, but it is used here:\n' +
          inspectPart(part, markUsedValue(props)),
      );
    }
    return new ElementBinding(props, part);
  },
};

export function createElement(
  type: string,
  props?: ElementProps,
  ...children: VNode[]
): VElement<NormalizeProps<ElementProps>>;
export function createElement<const TProps extends ElementProps>(
  type: ComponentType<NormalizeProps<TProps>>,
  props: TProps,
  ...children: VNode[]
): VElement<NormalizeProps<TProps>>;
export function createElement<const TProps extends ElementProps>(
  type: VElementType<NormalizeProps<TProps>>,
  props: TProps = {} as TProps,
  ...children: VNode[]
): VElement<NormalizeProps<TProps>> {
  const { key, ...restProps } = props;
  return new VElement(type, { children, ...restProps }, key);
}

export function createFragment(children: VNode[]): VFragment {
  return new VFragment(children);
}

export class VElement<TProps extends ElementProps = ElementProps>
  implements Bindable<unknown>
{
  readonly type: VElementType<TProps>;

  readonly props: TProps;

  readonly key: unknown;

  constructor(type: VElementType<TProps>, props: TProps, key?: unknown) {
    this.type = type;
    this.props = props;
    this.key = key;
  }

  [$toDirective](): Directive<unknown> {
    if (typeof this.type === 'function') {
      return {
        type: new FunctionComponent(this.type),
        value: this.props,
      };
    } else {
      const element = new DirectiveSpecifier(ElementDirective, this.props);
      const children = Array.isArray(this.props.children)
        ? new VFragment(this.props.children)
        : resolveChild(this.props.children as VNode);
      return {
        type: new ElementTemplate(this.type),
        value: [element, children],
      };
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

export class VStaticElement<TProps extends ElementProps = ElementProps>
  implements Bindable<unknown>
{
  readonly type: VElementType<TProps>;

  readonly props: TProps;

  readonly key: unknown;

  constructor(type: VElementType<TProps>, props: TProps, key?: unknown) {
    this.type = type;
    this.props = props;
    this.key = key;
  }

  [$toDirective](): Directive<unknown> {
    if (typeof this.type === 'function') {
      return {
        type: new FunctionComponent(this.type),
        value: this.props,
      };
    } else {
      const element = new DirectiveSpecifier(ElementDirective, this.props);
      const children = Array.isArray(this.props.children)
        ? new VStaticFragment(this.props.children)
        : resolveChild(this.props.children as VNode);
      return {
        type: new ElementTemplate(this.type),
        value: [element, children],
      };
    }
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
          templates.push(new ElementTemplate(child.type));
          binds.push(
            new DirectiveSpecifier(ElementDirective, child.props),
            Array.isArray(child.props.children)
              ? new VFragment(child.props.children)
              : resolveChild(child.props.children as VNode),
          );
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

export class ElementBinding implements Binding<ElementProps> {
  private _pendingProps: ElementProps;

  private _memoizedProps: ElementProps | null = null;

  private readonly _part: ElementPart;

  private readonly _listenerMap: Map<string, EventListenerWithOptions> =
    new Map();

  constructor(props: ElementProps, part: ElementPart) {
    this._pendingProps = props;
    this._part = part;
  }

  get type(): DirectiveType<ElementProps> {
    return ElementDirective as DirectiveType<ElementProps>;
  }

  get value(): ElementProps {
    return this._pendingProps;
  }

  get part(): ElementPart {
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

  hydrate(_hydrationTree: HydrationTree, _context: UpdateContext): void {}

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
        if (narrowElement(element, 'INPUT')) {
          element.checked = false;
          return;
        }
        break;
      case 'defaultChecked':
        if (narrowElement(element, 'INPUT')) {
          element.defaultChecked = false;
          return;
        }
        break;
      case 'defaultValue':
        if (narrowElement(element, 'INPUT', 'OUTPUT', 'TEXTAREA')) {
          element.defaultValue = '';
          return;
        }
        break;
      case 'htmlFor':
        if (narrowElement(element, 'LABEL')) {
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
          (value ?? {}) as StyleProps,
        );
        return;
      case 'value':
        if (narrowElement(element, 'INPUT', 'OUTPUT', 'SELECT', 'TEXTAREA')) {
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
        if (narrowElement(element, 'INPUT')) {
          const newChecked = !!newValue;
          const oldChecked = element.checked;
          if (newChecked !== oldChecked) {
            element.checked = newChecked;
          }
          return;
        }
        break;
      case 'defaultChecked':
        if (narrowElement(element, 'INPUT')) {
          if (!Object.is(newValue, oldValue)) {
            element.defaultChecked = !!newValue;
          }
          return;
        }
        break;
      case 'defaultValue':
        if (narrowElement(element, 'INPUT', 'OUTPUT', 'TEXTAREA')) {
          if (!Object.is(newValue, oldValue)) {
            element.defaultValue = safeToString(newValue);
          }
          return;
        }
        break;
      case 'htmlFor':
        if (narrowElement(element, 'LABEL')) {
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
          (newValue ?? {}) as StyleProps,
          (oldValue ?? {}) as StyleProps,
        );
        return;
      case 'value':
        if (narrowElement(element, 'INPUT', 'OUTPUT', 'SELECT', 'TEXTAREA')) {
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
      if (newValue == null) {
        element.removeAttribute(key);
      } else {
        element.setAttribute(key, newValue.toString());
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

function narrowElement<
  const TName extends Uppercase<keyof HTMLElementTagNameMap>,
>(
  element: Element,
  ...expectedNames: TName[]
): element is HTMLElementTagNameMap[Lowercase<TName>] {
  return (expectedNames as string[]).includes(element.tagName);
}

function resolveKey(child: VNode, index: number): unknown {
  return child instanceof VElement ? (child.key ?? index) : index;
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

function safeToString(value: unknown): string {
  return value?.toString() ?? '';
}
