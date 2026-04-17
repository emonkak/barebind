export const Bind = Symbol('Bind');
export const Fragment = Symbol('Fragment');
export const Primitive = Symbol('Primitive');

export const html = createTemplate('html');
export const svg = createTemplate('svg');
export const math = createTemplate('math');
export const text = createTemplate('textarea');

export interface Component<TProps, TReturn> {
  (props: TProps): VComponent<TProps, TReturn>;
  render: ComponentFunction<TProps, TReturn>;
  arePropsEqual: (oldProps: TProps, newProps: TProps) => boolean;
}

export type ComponentFunction<TProps, TReturn> = (
  this: RenderContext,
  props: TProps,
) => TReturn;

export interface ComponentOptions<TProps> {
  arePropsEqual?: (oldProps: TProps, newProps: TProps) => boolean;
}

export interface HostAdapter {
  renderNode(element: VHostElement): HostNode;
}

export interface HostNode {
  prepareUpdate(
    type: VHostElement['type'],
    oldProps: VHostElement['props'],
    newProps: VHostElement['props'],
  ): boolean;
  appendChild(child: HostNode, after: HostNode | null): void;
  moveChild(child: HostNode, after: HostNode | null): void;
  removeChild(child: HostNode): void;
  commitMount(type: VHostElement['type'], props: VHostElement['props']): void;
  commitUpdate(
    type: VHostElement['type'],
    oldProps: VHostElement['props'],
    newProps: VHostElement['props'],
  ): void;
}

export interface RenderContext {}

export type TemplateMode = 'html' | 'math' | 'svg' | 'textarea';

export type VElement = VComponent | VFragment | VHostElement;

export type VBind = VNode<typeof Bind, { index: number }, [VElement]>;

export type VComponent<TProps = {}, TReturn = unknown> = VNode<
  Component<TProps, TReturn>,
  TProps,
  []
>;

export type VFragment = VNode<typeof Fragment, {}, VElement[]>;

export type VHostElement = VBind | VPortal | VPrimitive | VTemplate;

export type VPortal = VNode<Element, {}, [VElement]>;

export type VPrimitive = VNode<typeof Primitive, { value: unknown }, []>;

export type VTemplate = VNode<
  readonly string[],
  {
    mode: TemplateMode;
  },
  VBind[]
>;

export class VNode<TType, TProps, const TChildren extends VElement[]> {
  type: TType;
  props: TProps;
  children: TChildren;
  key: unknown;

  constructor(type: TType, props: TProps, children: TChildren, key?: unknown) {
    this.type = type;
    this.props = props;
    this.children = children;
    this.key = key;
  }

  withKey(key: unknown): VNode<TType, TProps, TChildren> {
    return new VNode(this.type, this.props, this.children, key);
  }
}

export function createComponent<TProps = {}, TReturn = unknown>(
  componentFn: ComponentFunction<TProps, TReturn>,
  { arePropsEqual = Object.is }: ComponentOptions<TProps> = {},
): Component<TProps, TReturn> {
  function Component(props: TProps): VComponent<TProps, TReturn> {
    return new VNode(Component, props, []);
  }

  Component.render = componentFn;
  Component.arePropsEqual = arePropsEqual;

  DEBUG: {
    Object.defineProperty(Component, 'name', {
      value: componentFn.name,
    });
  }

  return Component;
}

export function createPortal(child: unknown, container: Element): VPortal {
  return new VNode(container, {}, [toElement(child)]);
}

export function createTemplate(
  mode: VTemplate['props']['mode'],
): (strings: readonly string[], ...children: unknown[]) => VTemplate {
  return (strings, ...children) =>
    new VNode(
      strings,
      {
        mode,
      },
      children.map(
        (child, index) => new VNode(Bind, { index }, [toElement(child)]),
      ),
    );
}

export function toElement(value: unknown): VElement {
  return value instanceof VNode
    ? value
    : typeof value === 'object' && isIterable(value)
      ? new VNode(Fragment, {}, Array.from(value, toElement))
      : new VNode(Primitive, { value }, []);
}

function isIterable(value: any): value is Iterable<unknown> {
  return typeof value?.[Symbol.iterator] === 'function';
}
