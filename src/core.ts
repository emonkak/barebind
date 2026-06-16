export const Bind = Symbol.for('barebind.Bind');
export const Fragment = Symbol.for('barebind.Fragment');
export const toElement = Symbol.for('barebind.toElement');

export const MUTATION_TYPE_INSERT = 0;
export const MUTATION_TYPE_UPDATE = 1;
export const MUTATION_TYPE_UPDATE_AND_MOVE = 2;
export const MUTATION_TYPE_REMOVE = 3;

export interface Component<TProps> {
  (props: TProps): VComponent<TProps>;
  arePropsEqual(oldProps: TProps, newProps: TProps): boolean;
  newHandle(dispatcher: Dispatcher): ComponentHandle<TProps>;
}

export interface ComponentHandle<TProps> {
  readonly pendingLanes: Lanes;
  render(props: TProps, scope: Scope, lanes: Lanes): VElement;
  connect(node: RenderNode.ComponentNode<TProps>): void;
  disconnect(): void;
}

export interface Dispatcher {
  readonly flushLanes: Lanes;
  nextIdentifier(): string;
  nextTransition(): number;
  schedule(unit: UpdateUnit, options?: UpdateOptions): UpdateHandle;
}

export interface HostAdapter {
  createHostNode(element: VHostElement, index: number): HostNode;
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
  afterCommit(): void;
  beforeRemove(): void;
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
      type: typeof MUTATION_TYPE_INSERT;
      node: RenderNode;
      afterNode: RenderNode | undefined;
    }
  | {
      type: typeof MUTATION_TYPE_UPDATE;
      oldNode: RenderNode;
      newNode: RenderNode;
    }
  | {
      type: typeof MUTATION_TYPE_UPDATE_AND_MOVE;
      oldNode: RenderNode;
      newNode: RenderNode;
      afterNode: RenderNode | undefined;
    }
  | {
      type: typeof MUTATION_TYPE_REMOVE;
      node: RenderNode;
    };

export interface Reconciler {
  diff(
    oldNode: RenderNode,
    newElement: VElement,
    scope: Scope,
    index: number,
    hostIndex: number,
    parent: RenderNode | null,
  ): RenderNode;
  nextRenderId(): number;
  render(
    element: VElement,
    scope: Scope,
    index?: number,
    hostIndex?: number,
    parent?: RenderNode | null,
  ): RenderNode;
}

export type RenderNode =
  | RenderNode.ComponentNode
  | RenderNode.FragmentNode
  | RenderNode.NativeNode;

export namespace RenderNode {
  interface Node<TElement extends VElement> {
    id: number;
    type: TElement['type'];
    props: TElement['props'];
    key: TElement['key'];
    index: number;
    hostIndex: number;
    parent: RenderNode | null;
    children: RenderNode[];
  }

  export interface ComponentNode<TProps = unknown> extends Node<VComponent> {
    state: {
      handle: ComponentHandle<TProps>;
      scope: Scope;
    };
  }

  export interface FragmentNode extends Node<VFragment> {
    state: {
      mutations: Mutation[];
    };
  }

  export interface NativeNode extends Node<VHostElement> {
    state: {
      hostNode: HostNode;
    };
  }
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

export type VBind = VNode<typeof Bind, { value: unknown }, []>;

export type VComponent<TProps = any> = VNode<Component<TProps>, TProps, []>;

export type VElement = VComponent | VFragment | VHostElement;

export type VFragment = VNode<typeof Fragment, {}, VElement[]>;

export type VHostElement = VBind | VPortal | VTemplate;

export type VPortal = VNode<Element, {}, [VElement]>;

export type VTemplate = VNode<
  readonly string[],
  {
    mode: TemplateMode;
  },
  VElement[]
>;

export class Ref<T> implements Renderable {
  current: T;

  constructor(current: T) {
    this.current = current;
    DEBUG: {
      Object.seal(this);
    }
  }

  [toElement](): VElement {
    return createBind((instance: T) => {
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
  readonly owner: Component<unknown> | null = null;

  static root(): Scope {
    return new Scope(null, 0, null);
  }

  private constructor(
    parent: Scope | null,
    level: number,
    owner: Component<unknown> | null,
  ) {
    this.parent = parent;
    this.level = level;
    this.owner = owner;
    DEBUG: {
      Object.freeze(this);
    }
  }

  child(owner: Component<unknown>): Scope {
    return new Scope(this, this.level + 1, owner);
  }

  peer(): Scope {
    return new Scope(this.parent, this.level, this.owner);
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

export function createBind(value: unknown): VBind {
  return new VNode(Bind, { value }, []);
}

export function createFragment(children: unknown[]): VFragment {
  return new VNode(Fragment, {}, Array.from(children, wrap));
}

export function createPortal(child: unknown, container: Element): VPortal {
  return new VNode(container, {}, [wrap(child)]);
}

export function createTemplate(
  mode: TemplateMode,
  strings: readonly string[],
  children: readonly unknown[],
): VTemplate {
  return new VNode(
    strings,
    {
      mode,
    },
    children.map(wrap),
  );
}

export function wrap(value: unknown): VElement {
  return value instanceof VNode
    ? value
    : isRenderable(value)
      ? value[toElement]()
      : typeof value === 'object' && isIterable(value)
        ? createFragment(Array.from(value, wrap))
        : createBind(value);
}

function isIterable(value: any): value is Iterable<unknown> {
  return typeof value?.[Symbol.iterator] === 'function';
}

function isRenderable(value: any): value is Renderable {
  return typeof value?.[toElement] === 'function';
}
