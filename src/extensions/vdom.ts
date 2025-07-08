import { defineComponent } from '../component.js';
import { inspectPart, markUsedValue } from '../debug.js';
import {
  $toDirectiveElement,
  type Bindable,
  type Binding,
  type CommitContext,
  type ComponentFunction,
  type Directive,
  type DirectiveContext,
  type DirectiveElement,
  DirectiveObject,
  isBindable,
  type UpdateContext,
} from '../directive.js';
import { HydrationError, type HydrationTree } from '../hydration.js';
import { type ElementPart, type Part, PartType } from '../part.js';
import { BlackholePrimitive } from '../primitive/blackhole.js';
import { TextPrimitive } from '../primitive/text.js';
import {
  type ItemType,
  RepeatBinding,
  RepeatDirective,
  type RepeatProps,
} from './repeat.js';

export type VChild =
  | VChild[]
  | VElement
  | Bindable<unknown>
  | bigint
  | boolean
  | number
  | string
  | symbol
  | null
  | undefined;

export type VProps = Record<string, unknown>;

export type VElementType<TProps> = ComponentFunction<TProps> | string;

type EventRegistry = Pick<
  EventTarget,
  'addEventListener' | 'removeEventListener'
>;

type EventListenerWithOptions =
  | EventListener
  | (EventListenerObject & AddEventListenerOptions);

export const VElementDirective: Directive<VElement> = {
  displayName: 'VElementDirective',
  resolveBinding(
    element: VElement,
    part: Part,
    _context: DirectiveContext,
  ): VElementBinding {
    if (part.type !== PartType.Element) {
      throw new Error(
        'VElementDirective must be used in an element part, but it is used here:\n' +
          inspectPart(part, markUsedValue(element)),
      );
    }
    return new VElementBinding(element, part);
  },
};

export function createElement<const TProps extends VProps>(
  type: VElementType<TProps>,
  props: TProps,
  ...children: VChild[]
): VElement<TProps> {
  return new VElement(type, props, children);
}

export function createFragment(
  children: VChild[],
): DirectiveObject<RepeatProps<VChild>> {
  return new DirectiveObject(RepeatDirective, createRepeatProps(children));
}

export class VFragment implements Bindable<RepeatProps<VChild>> {
  readonly children: VChild[];

  constructor(children: VChild[]) {
    this.children = children;
  }

  [$toDirectiveElement](): DirectiveElement<RepeatProps<VChild>> {
    return {
      directive: RepeatDirective,
      value: { source: this.children },
    };
  }
}

export class VElement<TProps extends VProps = VProps>
  implements Bindable<RepeatProps<VChild>>
{
  readonly type: VElementType<TProps>;

  readonly props: TProps;

  readonly children: VChild[];

  constructor(type: VElementType<TProps>, props: TProps, children: VChild[]) {
    this.type = type;
    this.props = props;
    this.children = children;
  }

  [$toDirectiveElement](): DirectiveElement<RepeatProps<VChild>> {
    return {
      directive: RepeatDirective,
      value: createRepeatProps([this]),
    };
  }
}

export class VElementBinding<TProps extends VProps = VProps>
  implements Binding<VElement<TProps>>
{
  private _pendingElement: VElement<TProps>;

  private _memoizedElement: VElement<TProps> | null = null;

  private readonly _part: ElementPart;

  private readonly _children: RepeatBinding<VChild, unknown, unknown>;

  private readonly _listenerMap: Map<string, EventListenerWithOptions> =
    new Map();

  constructor(element: VElement<TProps>, part: ElementPart) {
    this._pendingElement = element;
    this._part = part;
    this._children = new RepeatBinding(
      { source: element.children ?? [] },
      {
        type: PartType.ChildNode,
        node: part.node.ownerDocument.createComment(''),
        childNode: null,
      },
    );
  }

  get directive(): Directive<VElement<TProps>> {
    return VElementDirective as Directive<VElement<TProps>>;
  }

  get value(): VElement<TProps> {
    return this._pendingElement;
  }

  get part(): ElementPart {
    return this._part;
  }

  shouldBind(element: VElement<TProps>): boolean {
    return this._memoizedElement !== element;
  }

  bind(element: VElement<TProps>): void {
    this._pendingElement = element;
    this._children.bind(createRepeatProps(element.children));
  }

  hydrate(hydrationTree: HydrationTree, context: UpdateContext): void {
    if (this._memoizedElement !== null) {
      throw new HydrationError(
        'Hydration is failed because the binding has already been initilized.',
      );
    }

    this._children.hydrate(hydrationTree, context);

    const childrenPart = this._children.part;

    hydrationTree
      .popNode(childrenPart.node.nodeType, childrenPart.node.nodeName)
      .replaceWith(childrenPart.node);
  }

  connect(context: UpdateContext): void {
    this._children.connect(context);
  }

  disconnect(context: UpdateContext): void {
    this._children.disconnect(context);
  }

  commit(context: CommitContext): void {
    const newProps = this._pendingElement.props;
    const oldProps = this._memoizedElement?.props ?? ({} as TProps);
    const element = this._part.node;

    for (const key of Object.keys(oldProps)) {
      if (!Object.hasOwn(newProps, key)) {
        removeProperty(element, key, oldProps[key as keyof TProps]!, this);
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

    if (this._memoizedElement === null) {
      element.appendChild(this._children.part.node);
    }

    DEBUG: {
      context.debugValue(
        this._children.directive,
        this._children.value,
        this._children.part,
      );
    }

    this._children.commit(context);

    this._memoizedElement = this._pendingElement;
  }

  rollback(context: CommitContext): void {
    const props = this._memoizedElement?.props;
    const element = this._part.node;

    if (props !== undefined) {
      for (const key of Object.keys(props)) {
        removeProperty(element, key, props[key as keyof TProps], this);
      }
    }

    this._children.rollback(context);

    DEBUG: {
      context.undebugValue(
        this._children.directive,
        this._children.value,
        this._children.part,
      );
    }

    if (this._memoizedElement !== undefined) {
      this._children.part.node.remove();
    }

    this._memoizedElement = null;
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

function createRepeatProps(children: VChild[]): RepeatProps<VChild> {
  return {
    source: children,
    keySelector: resolveKey,
    valueSelector: resolveValue,
    itemTypeResolver: resolveItemType,
  };
}

function narrowElement<
  const TType extends Uppercase<keyof HTMLElementTagNameMap>,
>(
  element: Element,
  ...expectedTypes: TType[]
): element is HTMLElementTagNameMap[Lowercase<TType>] {
  return (expectedTypes as string[]).includes(element.tagName);
}

function removeProperty(
  element: Element,
  key: string,
  value: unknown,
  target: EventRegistry,
): void {
  switch (key.toLowerCase()) {
    case 'children':
    case 'key':
      // Skip special properties.
      return;
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
    case 'checked':
      if (narrowElement(element, 'INPUT')) {
        element.checked = element.defaultChecked;
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
          key.slice(2),
          value as EventListenerWithOptions,
        );
        return;
      }
  }

  element.removeAttribute(key);
}

function resolveItemType(child: VChild): ItemType {
  if (child == null || typeof child === 'boolean') {
    return {
      type: Node.COMMENT_NODE,
    };
  } else if (Array.isArray(child)) {
    return {
      type: Node.COMMENT_NODE,
    };
  } else if (child instanceof VElement) {
    if (typeof child.type === 'string') {
      return {
        type: Node.ELEMENT_NODE,
        name: child.type,
      };
    } else {
      return {
        type: Node.COMMENT_NODE,
      };
    }
  } else if (isBindable(child)) {
    return {
      type: Node.COMMENT_NODE,
    };
  } else {
    return {
      type: Node.TEXT_NODE,
    };
  }
}

function resolveKey(child: VChild, index: number): unknown {
  return child instanceof VElement ? (child.props['key'] ?? index) : index;
}

function resolveValue(child: VChild): Bindable<unknown> {
  if (child == null || typeof child === 'boolean') {
    return new DirectiveObject(BlackholePrimitive, child);
  } else if (Array.isArray(child)) {
    return new DirectiveObject(RepeatDirective, createRepeatProps(child));
  } else if (child instanceof VElement) {
    if (typeof child.type === 'string') {
      return new DirectiveObject(VElementDirective, child);
    } else {
      const directive = defineComponent(child.type);
      return new DirectiveObject(directive, child.props);
    }
  } else if (isBindable(child)) {
    return child;
  } else {
    return new DirectiveObject(TextPrimitive, child);
  }
}

function updateProperty(
  element: Element,
  key: string,
  newValue: unknown,
  oldValue: unknown,
  target: EventRegistry,
): void {
  switch (key.toLowerCase()) {
    case 'children':
    case 'key':
      // Skip special properties.
      return;
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
