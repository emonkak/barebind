import { shallowEqual } from '../compare.js';
import { defineComponent } from '../component.js';
import { inspectPart, markUsedValue } from '../debug.js';
import type {
  Binding,
  CommitContext,
  DirectiveContext,
  Primitive,
  UpdateContext,
} from '../directive.js';
import {
  $toDirectiveElement,
  type Bindable,
  type ComponentFunction,
  type DirectiveElement,
  DirectiveSpecifier,
  isBindable,
} from '../directive.js';
import type { HydrationTree } from '../hydration.js';
import { type ElementPart, type Part, PartType } from '../part.js';
import { BlackholePrimitive } from '../primitive/blackhole.js';
import { ElementTemplate } from '../template/element-template.js';
import { TextTemplate } from '../template/text-template.js';
import { RepeatDirective, type RepeatProps } from './repeat.js';

export type VChild =
  | VChild[]
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

type EventRegistry = Pick<
  EventTarget,
  'addEventListener' | 'removeEventListener'
>;

type EventListenerWithOptions =
  | EventListener
  | (EventListenerObject & AddEventListenerOptions);

const TEXT_TEMPLATE = new TextTemplate('', '');

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

  [$toDirectiveElement](): DirectiveElement<unknown> {
    if (typeof this.type === 'function') {
      return {
        directive: defineComponent(this.type),
        value: this.props,
      };
    } else {
      return {
        directive: new ElementTemplate(this.type),
        value: [
          new DirectiveSpecifier(ElementDirective, this.props),
          new DirectiveSpecifier(
            RepeatDirective,
            createRepeatProps(getChildren(this.props)),
          ),
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

  [$toDirectiveElement](): DirectiveElement<RepeatProps<VChild>> {
    return {
      directive: RepeatDirective,
      value: createRepeatProps(this.children),
    };
  }
}

export class ElementBinding<TProps extends ElementProps>
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

export function createElement<const TProps extends ElementProps>(
  type: VElementType<TProps>,
  props: TProps = {} as TProps,
  ...children: VChild[]
): VElement<{ children: VChild[] } & TProps> {
  return new VElement(type, { children, ...props }, children);
}

export function createFragment(children: VChild[]): VFragment {
  return new VFragment(children);
}

function createRepeatProps(children: VChild[]): RepeatProps<VChild> {
  return {
    source: children,
    keySelector: resolveKey,
    valueSelector: resolveValue,
  };
}

function getChildren(props: ElementProps): VChild[] {
  if (Object.hasOwn(props, 'children')) {
    return Array.isArray(props['children'])
      ? (props['children'] as VChild[])
      : [props['children'] as VChild];
  } else {
    return [];
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
