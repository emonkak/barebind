import { shallowEqual } from '../compare.js';
import { inspectPart, markUsedValue } from '../debug.js';
import type {
  Binding,
  CommitContext,
  Directive,
  DirectiveContext,
  Primitive,
  Template,
  TemplateResult,
  UpdateContext,
} from '../directive.js';
import type { HydrationTree } from '../hydration.js';
import {
  type ChildNodePart,
  type ElementPart,
  type Part,
  PartType,
} from '../part.js';
import { TemplateBinding } from '../template/template.js';

export type ElementProps = Record<string, unknown>;

type EventRegistry = Pick<
  EventTarget,
  'addEventListener' | 'removeEventListener'
>;

type EventListenerWithOptions =
  | EventListener
  | (EventListenerObject & AddEventListenerOptions);

export const ElementDirective: Primitive<ElementProps> = {
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

export class ElementBinding<TProps extends Record<string, unknown>>
  implements Binding<TProps>
{
  private _pendingProps: TProps;

  private _memoizedProps: TProps | null = null;

  protected readonly _part: ElementPart;

  private readonly _listenerMap: Map<string, EventListenerWithOptions> =
    new Map();

  constructor(props: TProps, part: ElementPart) {
    this._pendingProps = props;
    this._part = part;
  }

  get directive(): Primitive<TProps> {
    return ElementDirective as Primitive<TProps>;
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

    this._memoizedProps = newProps;
  }

  rollback(_context: CommitContext): void {
    const props = this._memoizedProps;
    const element = this._part.node;

    if (props !== null) {
      for (const key of Object.keys(props)) {
        removeProperty(element, key, props[key as keyof TProps], this);
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

export class ElementTemplate<TProps, TChildren>
  implements Template<readonly [TProps, TChildren]>
{
  private readonly _name: string;

  constructor(name: string) {
    this._name = name;
  }

  get displayName(): string {
    return ElementTemplate.name;
  }

  equals(other: Directive<unknown>): boolean {
    return other instanceof ElementTemplate && other._name === this._name;
  }

  hydrate(
    binds: readonly [TProps, TChildren],
    part: ChildNodePart,
    hydrationTree: HydrationTree,
    context: UpdateContext,
  ): TemplateResult {
    const document = part.node.ownerDocument;
    const elementPart = {
      type: PartType.Element,
      node: hydrationTree.popNode(Node.ELEMENT_NODE, this._name.toUpperCase()),
    };
    const childrenPart = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      childNode: null,
    };
    const elementSlot = context.resolveSlot(binds[0], elementPart);
    const childrenSlot = context.resolveSlot(binds[1], childrenPart);

    elementSlot.hydrate(hydrationTree, context);
    childrenSlot.hydrate(hydrationTree, context);

    hydrationTree
      .popNode(childrenPart.node.nodeType, childrenPart.node.nodeName)
      .replaceWith(childrenPart.node);

    return {
      childNodes: [elementPart.node],
      slots: [elementSlot, childrenSlot],
    };
  }

  render(
    binds: readonly [TProps, TChildren],
    part: ChildNodePart,
    context: UpdateContext,
  ): TemplateResult {
    const document = part.node.ownerDocument;
    const elementPart = {
      type: PartType.Element,
      node: document.createElement(this._name),
    };
    const childrenPart = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      childNode: null,
    };
    const elementSlot = context.resolveSlot(binds[0], elementPart);
    const childrenSlot = context.resolveSlot(binds[1], childrenPart);

    elementSlot.connect(context);
    childrenSlot.connect(context);

    elementPart.node.appendChild(childrenPart.node);

    return {
      childNodes: [elementPart.node],
      slots: [elementSlot, childrenSlot],
    };
  }

  resolveBinding(
    binds: readonly [TProps, TChildren],
    part: Part,
    _context: DirectiveContext,
  ): Binding<readonly [TProps, TChildren]> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'ElementTemplate must be used in a child node part, but it is used here in:\n' +
          inspectPart(part, markUsedValue(binds)),
      );
    }

    return new TemplateBinding(this, binds, part);
  }
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
