import { shallowEqual } from '../compare.js';
import { ComponentDirective } from '../component.js';
import { inspectPart, markUsedValue } from '../debug.js';
import type {
  Binding,
  CommitContext,
  DirectiveContext,
  DirectiveType,
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
import {
  ElementTemplate,
  HTML_NAMESPACE,
} from '../template/element-template.js';
import { TextTemplate } from '../template/text-template.js';
import { RepeatDirective, type RepeatProps } from './repeat.js';

export type VChild = VNode | VNode[];

export type VNode =
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

export type ElementProps = Record<string, unknown> & { children: unknown };

type NormalizeProps<TProps> = { children: VChild[] } & Omit<TProps, 'key'>;

type ReadonlyEventTarget = Pick<
  EventTarget,
  'addEventListener' | 'removeEventListener'
>;

type EventListenerWithOptions =
  | EventListener
  | (EventListenerObject & AddEventListenerOptions);

type Ref<T> =
  | { current: T }
  | (((current: T) => (() => void) | void) & {
      [$cleanup]?: (() => void) | void;
    })
  | null
  | undefined;

const TEXT_TEMPLATE = new TextTemplate('', '');

const $cleanup = Symbol('$cleanup');

export const ElementDirective: DirectiveType<ElementProps> = {
  displayName: 'ElementDirective',
  resolveBinding(
    props: ElementProps,
    part: Part,
    _context: DirectiveContext,
  ): ElementBinding<ElementProps> {
    if (part.type !== PartType.Element) {
      throw new Error(
        'ElementDirective must be used in an element part, but it is used here:\n' +
          inspectPart(part, markUsedValue(props)),
      );
    }
    return new ElementBinding(props, part);
  },
};

export class VElement<TProps extends ElementProps = ElementProps>
  implements Bindable<unknown>
{
  readonly type: VElementType<TProps>;

  readonly props: TProps;

  readonly key: unknown;

  constructor(type: VElementType<TProps>, props: TProps, key: unknown) {
    this.type = type;
    this.props = props;
    this.key = key;
  }

  [$toDirective](): Directive<unknown> {
    if (typeof this.type === 'function') {
      return {
        type: new ComponentDirective(this.type),
        value: this.props,
      };
    } else {
      let namespaceURI: string | null;
      let children: VChild;

      if (Object.hasOwn(this.props, 'namespaceURI')) {
        namespaceURI = this.props['namespaceURI'] as string | null;
        children = mapChildren(this.props.children as VChild, (child) =>
          child instanceof VElement
            ? new VElement(
                child.type,
                { namespaceURI, ...child.props },
                child.key,
              )
            : child,
        );
      } else {
        namespaceURI = HTML_NAMESPACE;
        children = this.props.children as VChild;
      }

      return {
        type: new ElementTemplate(this.type, namespaceURI),
        value: [
          new DirectiveSpecifier(ElementDirective, this.props),
          resolveChildren(children),
        ],
      };
    }
  }
}

export class VFragment implements Bindable<RepeatProps<VChild>> {
  readonly children: VChild[];

  constructor(children: VChild[]) {
    this.children = children;
  }

  [$toDirective](): Directive<RepeatProps<VChild>> {
    return {
      type: RepeatDirective,
      value: {
        source: this.children,
        keySelector: resolveKey,
        valueSelector: resolveValue,
      },
    };
  }
}

export class ElementBinding<TProps extends ElementProps>
  implements Binding<TProps>
{
  private _pendingProps: TProps;

  private _memoizedProps: TProps | null = null;

  private readonly _part: ElementPart;

  private readonly _listenerMap: Map<string, EventListenerWithOptions> =
    new Map();

  constructor(props: TProps, part: ElementPart) {
    this._pendingProps = props;
    this._part = part;
  }

  get type(): DirectiveType<TProps> {
    return ElementDirective as DirectiveType<TProps>;
  }

  get value(): TProps {
    return this._pendingProps;
  }

  get part(): ElementPart {
    return this._part;
  }

  shouldBind(props: TProps): boolean {
    return (
      this._memoizedProps === null || !shallowEqual(this._memoizedProps, props)
    );
  }

  bind(props: TProps): void {
    this._pendingProps = props;
  }

  hydrate(_hydrationTree: HydrationTree, _context: UpdateContext): void {}

  connect(_context: UpdateContext): void {}

  disconnect(_context: UpdateContext): void {}

  commit(_context: CommitContext): void {
    const newProps = this._pendingProps;
    const oldProps = this._memoizedProps ?? ({} as TProps);
    const element = this._part.node;

    for (const key of Object.keys(oldProps)) {
      if (!Object.hasOwn(newProps, key)) {
        deleteProperty(element, key, oldProps[key as keyof TProps]!, this);
      }
    }

    for (const key of Object.keys(newProps)) {
      updateProperty(
        element,
        key,
        newProps[key as keyof TProps],
        oldProps[key as keyof TProps],
        this,
      );
    }

    this._memoizedProps = newProps;
  }

  rollback(_context: CommitContext): void {
    const props = this._memoizedProps;
    const element = this._part.node;

    if (props !== null) {
      for (const key of Object.keys(props)) {
        deleteProperty(element, key, props[key as keyof TProps], this);
      }
    }

    this._memoizedProps = null;
  }

  addEventListener(type: string, listener: EventListenerWithOptions): void {
    if (!this._listenerMap.has(type)) {
      if (typeof listener === 'function') {
        this._part.node.addEventListener(type, this);
      } else {
        this._part.node.addEventListener(type, this, listener);
      }
    }

    this._listenerMap.set(type, listener);
  }

  removeEventListener(type: string, listener: EventListenerWithOptions): void {
    if (typeof listener === 'function') {
      this._part.node.removeEventListener(type, this);
    } else {
      this._part.node.removeEventListener(type, this, listener);
    }

    this._listenerMap.delete(type);
  }

  handleEvent(event: Event): void {
    const listener = this._listenerMap.get(event.type);

    if (typeof listener === 'function') {
      listener(event);
    } else {
      listener?.handleEvent(event);
    }
  }
}

export function createElement<const TProps extends ElementProps>(
  type: VElementType<NormalizeProps<TProps>>,
  props: TProps,
  ...children: VChild[]
): VElement<NormalizeProps<TProps>> {
  const { key, ...restProps } = props;
  return new VElement(type, { children, ...restProps }, key);
}

export function createFragment(children: VChild[]): VFragment {
  return new VFragment(children);
}

function cleanupRef(ref: NonNullable<Ref<Element | null>>): void {
  if (typeof ref === 'function') {
    if (ref[$cleanup] !== undefined) {
      ref[$cleanup]();
      ref[$cleanup] = undefined;
    }
  } else {
    ref.current = null;
  }
}

function deleteProperty(
  element: Element,
  key: string,
  value: unknown,
  target: ReadonlyEventTarget,
): void {
  switch (key) {
    case 'children':
    case 'key':
      // Skip special properties.
      return;
    case 'className':
    case 'innerHTML':
    case 'textContent':
      element[key] = '';
      return;
    case 'checked':
      if (narrowElement(element, 'INPUT')) {
        element.checked = element.defaultChecked;
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
        cleanupRef(value as NonNullable<Ref<Element | null>>);
      }
      return;
    case 'style':
      if (typeof value === 'object' || value === undefined) {
        deleteStyles(
          (element as HTMLElement).style,
          (value ?? {}) as StyleProps,
        );
        return;
      }
      break;
    case 'value':
      if (narrowElement(element, 'INPUT', 'OUTPUT', 'TEXTAREA')) {
        element.value = element.defaultValue;
        return;
      } else if (narrowElement(element, 'SELECT')) {
        element.value = '';
        return;
      }
      break;
    default:
      if (key.length > 2 && key.startsWith('on')) {
        target.removeEventListener(
          key.slice(2).toLowerCase(),
          value as EventListenerWithOptions,
        );
        return;
      }
  }

  element.removeAttribute(key);
}

function invokeRef(
  ref: NonNullable<Ref<Element | null>>,
  element: Element,
): void {
  if (typeof ref === 'function') {
    ref[$cleanup] = ref(element);
  } else {
    ref.current = element;
  }
}

function mapChildren(child: VChild, selector: (node: VNode) => VNode): VChild {
  if (Array.isArray(child)) {
    return child.map(selector);
  } else {
    return selector(child);
  }
}

function narrowElement<
  const TName extends Uppercase<keyof HTMLElementTagNameMap>,
>(
  element: Element,
  ...expectedNames: TName[]
): element is HTMLElementTagNameMap[Lowercase<TName>] {
  return (expectedNames as string[]).includes(element.tagName);
}

function resolveChildren(children: VChild): Bindable<unknown> {
  if (Array.isArray(children)) {
    return new VFragment(children);
  } else {
    return new DirectiveSpecifier(ChildNodeTemplate, [resolveValue(children)]);
  }
}

function resolveKey(child: VChild, index: number): unknown {
  return child instanceof VElement ? (child.key ?? index) : index;
}

function resolveValue(child: VChild): Bindable<unknown> {
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

function updateProperty(
  element: Element,
  key: string,
  newValue: unknown,
  oldValue: unknown,
  target: ReadonlyEventTarget,
): void {
  switch (key) {
    case 'children':
    case 'key':
      // Skip special properties.
      return;
    case 'className':
    case 'innerHTML':
    case 'textContent':
      if (!Object.is(newValue, oldValue)) {
        element[key] = newValue?.toString() ?? '';
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
          element.defaultValue = newValue?.toString() ?? '';
        }
        return;
      }
      break;
    case 'htmlFor':
      if (narrowElement(element, 'LABEL')) {
        if (!Object.is(newValue, oldValue)) {
          element.htmlFor = newValue?.toString() ?? '';
        }
        return;
      }
      break;
    case 'ref':
      if (newValue !== oldValue) {
        if (oldValue != null) {
          invokeRef(oldValue as NonNullable<Ref<Element | null>>, element);
        }
        if (newValue != null) {
          cleanupRef(newValue as NonNullable<Ref<Element | null>>);
        }
      }
      return;
    case 'style':
      if (
        (typeof newValue === 'object' || newValue === undefined) &&
        (typeof oldValue === 'object' || oldValue === undefined)
      ) {
        updateStyles(
          (element as HTMLElement).style,
          (newValue ?? {}) as StyleProps,
          (oldValue ?? {}) as StyleProps,
        );
        return;
      }
      break;
    case 'value':
      if (narrowElement(element, 'INPUT', 'OUTPUT', 'SELECT', 'TEXTAREA')) {
        const newString = newValue?.toString() ?? '';
        const oldString = element.value;
        if (newString !== oldString) {
          element.value = newString;
        }
        return;
      }
      break;
    default:
      if (key.length > 2 && key.startsWith('on')) {
        if (newValue !== oldValue) {
          if (oldValue != null) {
            target.removeEventListener(
              key.slice(2).toLowerCase(),
              oldValue as EventListenerWithOptions,
            );
          }
          if (newValue != null) {
            target.addEventListener(
              key.slice(2).toLowerCase(),
              newValue as EventListenerWithOptions,
            );
          }
        }
        return;
      }
  }

  if (!Object.is(newValue, oldValue)) {
    element.setAttribute(key, newValue?.toString() ?? '');
  }
}
