export const Bind = Symbol.for('barebind.Bind');
export const Fragment = Symbol.for('barebind.Fragment');
export const toElement = Symbol.for('barebind.toElement');

export const enum MutationType {
  Insert = 0,
  Update = 1,
  UpdateAndMove = 2,
  Remove = 3,
}

export const enum NodeFlag {
  NoFlags /*   */ = 0b00,
  Committed /* */ = 0b01,
  Detached /*  */ = 0b10,
}

export interface Bindable {
  [toElement](): VElement;
}

export interface Block {
  readonly parts: readonly Part[];
  readonly hostNodes: readonly HostNode[];
  mountBefore(afterNode: HostNode): void;
  mountInto(container: HostContainer, afterNode: HostNode | null): void;
  moveBefore(afterNode: HostNode): void;
  moveInto(container: HostContainer, afterNode: HostNode | null): void;
  unmount(): void;
}

export type Commit = () => void;

export type CommitHandler = (commit: Commit) => Promise<void> | void;

export interface Component<TProps> {
  (props: TProps): VComponent<TProps>;
  createRenderer(dispatcher: Dispatcher): ComponentRenderer<TProps>;
}

export interface ComponentRenderer<TProps> {
  afterCommit(): void;
  beforeUnmount(): void;
  render(
    node: RenderNode.ComponentNode<TProps>,
    scope: Scope,
    renderLanes: Lanes,
  ): RenderResult;
  shouldRender(oldProps: TProps, newProps: TProps): boolean;
}

export interface Dispatcher {
  readonly renderLanes: Lanes;
  readonly txId: number;
  build(
    element: VElement,
    index: number,
    parent: RenderNode | null,
    scope: Scope,
    part: Part,
  ): RenderNode;
  diff(
    oldNode: RenderNode,
    newElement: VElement,
    index: number,
    parent: RenderNode | null,
    scope: Scope,
    dirty: boolean,
  ): RenderNode;
  nextIdentifier(): string;
  nextTransition(): number;
  schedule(transaction: Transaction, options?: UpdateOptions): UpdateHandle;
}

export interface HostAdapter {
  getIdentifier(): string;
  getRenderLanes(): Lanes;
  renderPortal(element: VPortal): Block;
  renderTemplate(element: VTemplate): Block;
  requestCommit(callback: () => void): Promise<void>;
  requestCallback(
    callback: () => void | PromiseLike<void>,
    options?: SchedulerPostTaskOptions,
  ): Promise<void>;
}

export type HostContainer = DocumentFragment | Element;

export type HostNode = unknown;

export interface Injectable<TInstance, TDefault> {
  new (...args: never[]): TInstance;
  getDefault?(): TDefault;
}

export interface Injection {
  instance: object;
  next: Injection | null;
}

export type Lanes = number;

export interface Middleware {
  handle(
    update: Update,
    dispatcher: Dispatcher,
    prepare: (update: Update, dispatcher: Dispatcher) => Commit,
  ): Commit;
}

export type Mutation =
  | {
      type: MutationType.Insert;
      node: RenderNode;
      afterNode: RenderNode | undefined;
    }
  | {
      type: MutationType.Update;
      oldNode: RenderNode;
      newNode: RenderNode;
      index: number;
    }
  | {
      type: MutationType.UpdateAndMove;
      oldNode: RenderNode;
      newNode: RenderNode;
      afterNode: RenderNode | undefined;
      index: number;
    }
  | {
      type: MutationType.Remove;
      node: RenderNode;
    };

export interface Part {
  splitPart(): Part;
  mountBlock(block: Block, afterNode: HostNode | null): void;
  moveBlock(block: Block, afterNode: HostNode | null): void;
  unmountBlock(block: Block, cascade: boolean): void;
  commitUpdate(oldValue: unknown, newValue: unknown): void;
  commitMount(value: unknown): void;
  commitUnmount(value: unknown, cascade: boolean): void;
}

export type RenderNode =
  | RenderNode.BindNode
  | RenderNode.BlockNode
  | RenderNode.ComponentNode
  | RenderNode.FragmentNode;

export namespace RenderNode {
  /**
   * All node variants share the same shape (monomorphic) — only `state`
   * differs by type. This avoids hidden-class transitions in JS engines.
   *
   * left/right are double-buffer child nodes (like binary tree nodes).
   * Invariant: left = work-in-progress, right = committed.
   * left === right means the node is already committed.
   */
  interface Node<TElement extends VElement, TState> {
    type: TElement['type'];
    props: TElement['props'];
    key: TElement['key'];
    index: number;
    parent: RenderNode | null;
    children: RenderNode[];
    part: Part;
    state: TState;
    flags: number;
  }

  export interface BindNode extends Node<VBind, null> {}

  export interface BlockNode
    extends Node<VPortal | VTemplate, { block: Block }> {}

  export interface ComponentNode<TProps = unknown>
    extends Node<
      VComponent,
      {
        renderer: ComponentRenderer<TProps>;
        pendingLanes: Lanes;
        txId: number;
        version: number;
      }
    > {}

  export interface FragmentNode
    extends Node<
      VFragment,
      {
        mutations: Mutation[];
      }
    > {}
}

export interface RenderResult {
  element: VElement;
  scope: Scope;
  renderLanes: Lanes;
  dirty: boolean;
}

export type Scope = Scope.Root | Scope.Child;

export namespace Scope {
  export interface Root {
    readonly owner: object;
    readonly parent: null;
    readonly level: number;
    injection: Injection | null;
  }

  export interface Child {
    readonly owner: object;
    readonly parent: Scope;
    readonly level: number;
    injection: Injection | null;
  }
}

export type TemplateMode = 'html' | 'math' | 'svg' | 'textarea';

export interface Transaction {
  readonly scope: Scope;
  readonly pendingLanes: Lanes;
  prepare(dispatcher: Dispatcher): Commit;
}

export interface Update {
  readonly id: number;
  readonly lanes: Lanes;
  readonly handler: CommitHandler | null;
  readonly controller: PromiseWithResolvers<void>;
  readonly transaction: Transaction;
}

export interface UpdateHandle {
  id: number;
  lanes: Lanes;
  finished: Promise<void>;
}

export interface UpdateOptions {
  delay?: number;
  flushSync?: boolean;
  handler?: CommitHandler;
  priority?: TaskPriority;
  transition?: number;
}

export type VBind<TValue = unknown> = VNode<typeof Bind, { value: TValue }, []>;

export type VComponent<TProps = any> = VNode<Component<TProps>, TProps, []>;

export type VElement = VComponent | VFragment | VBind | VPortal | VTemplate;

export type VFragment = VNode<typeof Fragment, {}, VElement[]>;

export type VPortal = VNode<HostContainer, {}, [VElement]>;

export type VTemplate = VNode<
  readonly string[],
  { mode: TemplateMode },
  VElement[]
>;

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
