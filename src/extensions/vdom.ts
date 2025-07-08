import { shallowEqual } from '../compare.js';
import { defineComponent } from '../component.js';
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
  type ComponentFunction,
  type Directive,
  DirectiveSpecifier,
  isBindable,
} from '../directive.js';
import type { HydrationTree } from '../hydration.js';
import { type ElementPart, type Part, PartType } from '../part.js';
import { BlackholePrimitive } from '../primitive/blackhole.js';
import {
  ElementTemplate,
  HTML_NAMESPACE,
} from '../template/element-template.js';
import { TextTemplate } from '../template/text-template.js';
import { RepeatDirective, type RepeatProps } from './repeat.js';

export type VNode =
  | VNode[]
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

export type ElementProps = Record<string, unknown>;

type NormalizeProps<TProps> = { children: VNode[] } & Omit<TProps, 'key'>;

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
        type: defineComponent(this.type),
        value: this.props,
      };
    } else {
      return {
        type: new ElementTemplate(this.type, HTML_NAMESPACE),
        value: [
          new DirectiveSpecifier(ElementDirective, this.props),
          new VFragment(getChildren(this.props)),
        ],
      };
    }
  }
}

export class VFragment implements Bindable<RepeatProps<VNode>> {
  readonly children: VNode[];

  constructor(children: VNode[]) {
    this.children = children;
  }

  [$toDirective](): Directive<RepeatProps<VNode>> {
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
  ...children: VNode[]
): VElement<NormalizeProps<TProps>> {
  const { key, ...restProps } = props;
  return new VElement(type, { children, ...restProps }, key);
}

export function createFragment(children: VNode[]): VFragment {
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
  switch (key.toLowerCase()) {
    case 'children':
    case 'key':
    case 'ref':
      // Skip special properties.
      return;
    case 'checked':
      if (narrowElement(element, 'INPUT')) {
        element.checked = element.defaultChecked;
        return;
      }
      break;
    case 'defaultchecked':
      if (narrowElement(element, 'INPUT')) {
        element.defaultChecked = false;
        return;
      }
      break;
    case 'defaultvalue':
      if (narrowElement(element, 'INPUT', 'OUTPUT', 'TEXTAREA')) {
        element.defaultValue = '';
        return;
      }
      break;
    case 'htmlfor':
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
          key.slice(2),
          value as EventListenerWithOptions,
        );
        return;
      }
  }

  element.removeAttribute(key);
}

function getChildren(props: ElementProps): VNode[] {
  if (Object.hasOwn(props, 'children')) {
    return Array.isArray(props['children'])
      ? (props['children'] as VNode[])
      : [props['children'] as VNode];
  } else {
    return [];
  }
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

function narrowElement<
  const TName extends Uppercase<keyof HTMLElementTagNameMap>,
>(
  element: Element,
  ...expectedNames: TName[]
): element is HTMLElementTagNameMap[Lowercase<TName>] {
  return (expectedNames as string[]).includes(element.tagName);
}

function resolveKey(node: VNode, index: number): unknown {
  return node instanceof VElement ? (node.key ?? index) : index;
}

function resolveValue(node: VNode): Bindable<unknown> {
  if (isBindable(node)) {
    return node;
  } else if (Array.isArray(node)) {
    return new VFragment(node);
  } else if (node == null || typeof node === 'boolean') {
    return new DirectiveSpecifier(BlackholePrimitive, node);
  } else {
    return new DirectiveSpecifier(TEXT_TEMPLATE, [node]);
  }
}

function updateProperty(
  element: Element,
  key: string,
  newValue: unknown,
  oldValue: unknown,
  target: ReadonlyEventTarget,
): void {
  switch (key.toLowerCase()) {
    case 'children':
    case 'key':
      // Skip special properties.
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
    case 'classname':
      if (!Object.is(newValue, oldValue)) {
        element.className = newValue?.toString() ?? '';
      }
      break;
    case 'defaultchecked':
      if (narrowElement(element, 'INPUT')) {
        if (!Object.is(newValue, oldValue)) {
          element.defaultChecked = !!newValue;
        }
        return;
      }
      break;
    case 'defaultvalue':
      if (narrowElement(element, 'INPUT', 'OUTPUT', 'TEXTAREA')) {
        if (!Object.is(newValue, oldValue)) {
          element.defaultValue = newValue?.toString() ?? '';
        }
        return;
      }
      break;
    case 'htmlfor':
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
              key.slice(2),
              oldValue as EventListenerWithOptions,
            );
          }
          if (newValue != null) {
            target.addEventListener(
              key.slice(2),
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
