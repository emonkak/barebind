export const Bind = Symbol.for('barebind.Bind');
export const Fragment = Symbol.for('barebind.Fragment');
export const Primitive = Symbol.for('barebind.Primitive');
export const toElement = Symbol.for('barebind.toElement');

// Mutation types
export const InsertType = 0;
export const UpdateType = 1;
export const UpdateAndMoveType = 2;
export const RemoveType = 3;

export interface ComponentType<TProps> {
  (props: TProps): VComponent<TProps>;
  arePropsEqual(oldProps: TProps, newProps: TProps): boolean;
  newInstance(dispatcher: Dispatcher): ComponentInstance<TProps>;
}

export interface ComponentInstance<TProps> {
  readonly pendingLanes: Lanes;
  render(
    node: RenderNode.ComponentNode<TProps>,
    scope: Scope,
    lanes: Lanes,
  ): VElement;
  afterCommit(node: RenderNode.ComponentNode<TProps>): void;
  beforeRemove(): void;
}

export interface Dispatcher {
  readonly flushLanes: Lanes;
  nextIdentifier(): string;
  nextTransition(): number;
  schedule(unit: UpdateUnit, options?: UpdateOptions): UpdateHandle;
}

export interface HostAdapter {
  createHostNode(element: VHostElement): HostNode;
  getIdentifier(): string;
  getTaskPriority(): TaskPriority;
  requestCommit(callback: () => void): Promise<void>;
  requestCallback(
    callback: () => void | PromiseLike<void>,
    options?: SchedulerPostTaskOptions,
  ): Promise<void>;
  startViewTransition(callback: () => void): Promise<void>;
  yieldToMain(): Promise<void>;
}

export interface HostNode {
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

export interface Injectable<TInstance, TDefault> {
  new (...args: never[]): TInstance;
  getDefault?(): TDefault;
}

export type Lane = number;

export type Lanes = number;

export type Mutation =
  | {
      type: typeof InsertType;
      node: RenderNode;
      afterNode: RenderNode | undefined;
    }
  | {
      type: typeof UpdateType;
      oldNode: RenderNode;
      newNode: RenderNode;
    }
  | {
      type: typeof UpdateAndMoveType;
      oldNode: RenderNode;
      newNode: RenderNode;
      afterNode: RenderNode | undefined;
    }
  | {
      type: typeof RemoveType;
      node: RenderNode;
    };

export interface Reconciler {
  diff(
    oldNode: RenderNode,
    newElement: VElement,
    scope: Scope,
    index: number,
    parent: RenderNode | null,
  ): RenderNode;
  nextRenderId(): number;
  render(
    element: VElement,
    scope: Scope,
    index?: number,
    parent?: RenderNode | null,
  ): RenderNode;
}

export type RenderNode =
  | RenderNode.ComponentNode
  | RenderNode.FragmentNode
  | RenderNode.NativeNode;

export namespace RenderNode {
  interface AbstractNode<TElement extends VElement, TData>
    extends Pick<TElement, 'type' | 'props' | 'key'> {
    id: number;
    index: number;
    parent: RenderNode | null;
    children: RenderNode[];
    data: TData;
  }

  export interface ComponentNode<TProps = any>
    extends AbstractNode<VComponent, ComponentInstance<TProps>> {}

  export interface FragmentNode extends AbstractNode<VFragment, Mutation[]> {}

  export interface NativeNode extends AbstractNode<VHostElement, HostNode> {}
}

export interface Renderable {
  [toElement](): VElement;
}

export type TemplateMode = 'html' | 'math' | 'svg' | 'textarea';

export type Thunk = () => void;

export interface UpdateHandle {
  id: number;
  lanes: Lanes;
  finished: Promise<void>;
}

export interface UpdateOptions {
  delay?: number;
  flushSync?: boolean;
  priority?: TaskPriority;
  transition?: number;
  viewTransition?: boolean;
}

export interface UpdateUnit {
  readonly level: number;
  readonly pendingLanes: Lanes;
  produce(lanes: Lanes, reconciler: Reconciler): Thunk;
}

export type VBind = VNode<typeof Bind, { index: number }, [VElement]>;

export type VComponent<TProps = any> = VNode<ComponentType<TProps>, TProps, []>;

export type VElement = VComponent | VFragment | VHostElement;

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

export class Ref<T> implements Renderable {
  current: T;

  constructor(current: T) {
    this.current = current;
    DEBUG: {
      Object.seal(this);
    }
  }

  [toElement](): VPrimitive {
    return createPrimitive((instance: T) => {
      this.current = instance;
      return () => {
        this.current = null as T;
      };
    });
  }
}

export class Scope {
  readonly parent: Scope | null;
  readonly level: number;
  readonly instances: object[] = [];

  constructor(parent: Scope | null = null, level: number = 0) {
    this.parent = parent;
    this.level = level;
    DEBUG: {
      Object.freeze(this);
    }
  }

  child(): Scope {
    return new Scope(this, this.level + 1);
  }

  peer(): Scope {
    return new Scope(this.parent, this.level);
  }
}

export class VNode<TType, TProps, const TChildren extends VElement[]> {
  readonly type: TType;
  readonly props: TProps;
  readonly children: TChildren;
  readonly key: unknown;

  constructor(type: TType, props: TProps, children: TChildren, key?: unknown) {
    this.type = type;
    this.props = props;
    this.children = children;
    this.key = key;
    DEBUG: {
      Object.freeze(this);
    }
  }

  withKey(key: unknown): VNode<TType, TProps, TChildren> {
    return new VNode(this.type, this.props, this.children, key);
  }
}

export function createFragment(value: unknown[]): VFragment {
  return new VNode(Fragment, {}, Array.from(value, wrap));
}

export function createPortal(value: unknown, container: Element): VPortal {
  return new VNode(container, {}, [wrap(value)]);
}

export function createPrimitive(value: unknown): VPrimitive {
  return new VNode(Primitive, { value }, []);
}

export function wrap(value: unknown): VElement {
  return value instanceof VNode
    ? value
    : isRenderable(value)
      ? value[toElement]()
      : typeof value === 'object' && isIterable(value)
        ? createFragment(Array.from(value, wrap))
        : createPrimitive(value);
}

function isIterable(value: any): value is Iterable<unknown> {
  return typeof value?.[Symbol.iterator] === 'function';
}

function isRenderable(value: any): value is Renderable {
  return typeof value?.[toElement] === 'function';
}
