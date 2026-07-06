export const Bind = Symbol.for('barebind.Bind');
export const Fragment = Symbol.for('barebind.Fragment');
export const toElement = Symbol.for('barebind.toElement');

export const MUTATION_TYPE_INSERT = 0;
export const MUTATION_TYPE_UPDATE = 1;
export const MUTATION_TYPE_UPDATE_AND_MOVE = 2;
export const MUTATION_TYPE_REMOVE = 3;

export interface Bindable {
  [toElement](): VElement;
}

export interface Block {
  readonly parts: readonly Part[];
  readonly staticNodes: readonly ChildNode[];
  mountBefore(afterNode: ChildNode): void;
  mountInto(container: Container, afterNode: ChildNode | null): void;
  moveBefore(afterNode: ChildNode): void;
  moveInto(container: Container, afterNode: ChildNode | null): void;
  unmount(): void;
}

export type Commit = () => void;

export interface Component<TProps> {
  (props: TProps): VComponent<TProps>;
  arePropsEqual(oldProps: TProps, newProps: TProps): boolean;
  createInstance(dispatcher: Dispatcher): ComponentInstance<TProps>;
}

export interface ComponentInstance<TProps> {
  readonly pendingLanes: Lanes;
  render(props: TProps, scope: Scope, lanes: Lanes): VElement;
  connect(node: RenderNode.ComponentNode<TProps>): void;
  disconnect(): void;
}

export type Container = DocumentFragment | Element;

export interface Dispatcher {
  nextIdentifier(): string;
  nextTransition(): number;
  schedule(transaction: Transaction, options?: UpdateOptions): UpdateHandle;
}

export interface HostAdapter {
  getIdentifier(): string;
  getTaskPriority(): TaskPriority;
  renderPortal(element: VPortal): Block;
  renderTemplate(element: VTemplate): Block;
  requestCommit(callback: () => void): Promise<void>;
  requestCallback(
    callback: () => void | PromiseLike<void>,
    options?: SchedulerPostTaskOptions,
  ): Promise<void>;
  startViewTransition(update: () => void, types: string[]): Promise<void>;
}

export interface Injectable<TInstance, TDefault> {
  new (...args: never[]): TInstance;
  getDefault?(): TDefault;
}

export type Lane = number;

export type Lanes = number;

export interface Middleware {
  handle(update: Update, render: (update: Update) => Commit): Commit;
}

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
      index: number;
    }
  | {
      type: typeof MUTATION_TYPE_UPDATE_AND_MOVE;
      oldNode: RenderNode;
      newNode: RenderNode;
      afterNode: RenderNode | undefined;
      index: number;
    }
  | {
      type: typeof MUTATION_TYPE_REMOVE;
      node: RenderNode;
    };

export type Owner = object;

export interface Part {
  splitPart(): Part;
  mountBlock(block: Block, afterNode: ChildNode | null): void;
  moveBlock(block: Block, afterNode: ChildNode | null): void;
  unmountBlock(block: Block, cascade: boolean): void;
  commitUpdate(oldValue: unknown, newValue: unknown): void;
  commitMount(value: unknown): void;
  commitUnmount(value: unknown, cascade: boolean): void;
}

export type RenderNode =
  | RenderNode.BindNode
  | RenderNode.ComponentNode
  | RenderNode.FragmentNode
  | RenderNode.BlockNode;

export namespace RenderNode {
  /**
   * left/right are double-buffer child nodes (like binary tree nodes).
   * Invariant: left = work-in-progress, right = committed.
   * left === right means the node is already committed.
   */
  interface Node<TElement extends VElement> {
    type: TElement['type'];
    props: TElement['props'];
    key: TElement['key'];
    index: number;
    parent: RenderNode | RenderRoot | null;
    left: RenderNode[]; // work-in-progress children
    right: RenderNode[]; // committed children
    part: Part;
    state: unknown;
  }

  export interface BindNode extends Node<VBind> {
    state: null;
  }

  export interface BlockNode extends Node<VPortal | VTemplate> {
    state: {
      block: Block;
    };
  }

  export interface ComponentNode<TProps = unknown> extends Node<VComponent> {
    state: {
      instance: ComponentInstance<TProps>;
      scope: Scope;
    };
  }

  export interface FragmentNode extends Node<VFragment> {
    state: {
      mutations: Mutation[];
    };
  }
}

export interface RenderRoot {
  type: null;
  left: RenderNode | null; // work-in-progress child
  right: RenderNode | null; // committed child
}

export interface Renderer {
  diff(
    oldNode: RenderNode,
    newElement: VElement,
    scope: Scope,
    index: number,
    parent: RenderNode | RenderRoot,
  ): RenderNode;
  render(
    element: VElement,
    scope: Scope,
    index: number,
    parent: RenderNode | RenderRoot,
    part: Part,
  ): RenderNode;
}

export type TemplateMode = 'html' | 'math' | 'svg' | 'textarea';

export interface Transaction {
  readonly scope: Scope;
  readonly pendingLanes: Lanes;
  prepare(lanes: Lanes, renderer: Renderer): Commit;
}

export interface Update {
  readonly id: number;
  readonly lanes: Lanes;
  readonly types: string[];
  readonly transaction: Transaction;
  readonly controller: PromiseWithResolvers<void>;
}

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
  viewTransition?: string[] | boolean;
}

export type VBind<T = unknown> = VNode<typeof Bind, { value: T }, []>;

export type VComponent<TProps = any> = VNode<Component<TProps>, TProps, []>;

export type VElement = VComponent | VFragment | VBind | VPortal | VTemplate;

export type VFragment = VNode<typeof Fragment, {}, VElement[]>;

export type VPortal<TContainer extends Container = Container> = VNode<
  TContainer,
  {},
  [VElement]
>;

export type VTemplate = VNode<
  readonly string[],
  { mode: TemplateMode },
  VElement[]
>;

export class Scope {
  readonly owner: Owner;
  readonly level: number;
  readonly parent: Scope | null;
  readonly instances: object[];

  static root(owner: Owner): Scope {
    return new Scope(owner, 0, null);
  }

  private constructor(
    owner: Owner,
    level: number,
    parent: Scope | null,
    instances: object[] = [],
  ) {
    this.owner = owner;
    this.level = level;
    this.parent = parent;
    this.instances = instances;
    DEBUG: {
      Object.freeze(this);
    }
  }

  enter(owner: Component<unknown>): Scope {
    return new Scope(owner, this.level + 1, this);
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
