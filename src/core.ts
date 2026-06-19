export const Bind = Symbol.for('barebind.Bind');
export const Fragment = Symbol.for('barebind.Fragment');
export const Root = Symbol.for('barebind.Root');
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
  mountInto(container: ParentNode, afterNode: ChildNode | null): void;
  moveBefore(afterNode: ChildNode): void;
  moveInto(container: ParentNode, afterNode: ChildNode | null): void;
  unmount(): void;
}

export type Commit = () => void;

export interface Component<TProps> {
  (props: TProps): VComponent<TProps>;
  arePropsEqual(oldProps: TProps, newProps: TProps): boolean;
  createHandle(dispatcher: Dispatcher): ComponentHandle<TProps>;
}

export interface ComponentHandle<TProps> {
  readonly pendingLanes: Lanes;
  render(props: TProps, scope: Scope, lanes: Lanes): VElement;
  connect(node: RenderNode.ComponentNode<TProps>): void;
  disconnect(): void;
}

export interface Dispatcher {
  nextIdentifier(): string;
  nextTransition(): number;
  schedule(unit: UpdateUnit, options?: UpdateOptions): UpdateHandle;
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
  startViewTransition(callback: () => void): Promise<void>;
  yieldToMain(): Promise<void>;
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

export interface Part {
  mountBlock(block: Block, afterNode: ChildNode | null): void;
  moveBlock(block: Block, afterNode: ChildNode | null): void;
  unmountBlock(block: Block, cascade: boolean): void;
  commitUpdate(oldValue: unknown, newValue: unknown): void;
  commitMount(value: unknown): void;
  commitUnmount(value: unknown): void;
}

export type RenderNode =
  | RenderNode.BindNode
  | RenderNode.ComponentNode
  | RenderNode.FragmentNode
  | RenderNode.BlockNode;

export namespace RenderNode {
  interface Node<TElement extends VElement> {
    type: TElement['type'];
    props: TElement['props'];
    key: TElement['key'];
    part: Part;
    index: number;
    parent: RenderNode | RenderRoot;
    children: RenderNode[];
    dirty: boolean;
    state: unknown;
  }

  export interface BindNode extends Node<VBind> {
    state: null;
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

  export interface BlockNode extends Node<VPortal | VTemplate> {
    state: {
      block: Block;
    };
  }
}

export interface RenderRoot {
  type: typeof Root;
  current: RenderNode | null;
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
  prepare(lanes: Lanes, renderer: Renderer): Commit;
}

export type VElement = VComponent | VFragment | VBind | VPortal | VTemplate;

export class Ref<T> implements Bindable {
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
  readonly owner: Component<unknown> | null = null;
  readonly instances: object[] = [];

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

  detach(): Scope {
    return new Scope(null, this.level, this.owner);
  }

  enter(owner: Component<unknown>): Scope {
    return new Scope(this, this.level + 1, owner);
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

  withKey(key: unknown): this {
    return new (this.constructor as typeof VNode)(
      this.type,
      this.props,
      this.children,
      key,
    ) as this;
  }
}

export class VBind<T = unknown> extends VNode<typeof Bind, { value: T }, []> {}

export class VComponent<TProps = any> extends VNode<
  Component<TProps>,
  TProps,
  []
> {}

export class VFragment extends VNode<typeof Fragment, {}, VElement[]> {}

export class VPortal<TContainer extends ParentNode = ParentNode> extends VNode<
  TContainer,
  {},
  [VElement]
> {}

export class VTemplate extends VNode<
  readonly string[],
  { mode: TemplateMode },
  VElement[]
> {}

export function createBind<T>(value: T): VBind<T> {
  return new VBind(Bind, { value }, []);
}

export function createFragment(children: Iterable<unknown>): VFragment {
  return new VFragment(Fragment, {}, Array.from(children, wrap));
}

export function createPortal<TContainer extends ParentNode>(
  child: unknown,
  container: TContainer,
): VPortal<TContainer> {
  return new VPortal(container, {}, [wrap(child)]);
}

export function createTemplate(
  mode: TemplateMode,
  strings: readonly string[],
  children: readonly unknown[],
): VTemplate {
  return new VTemplate(
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
    : isBindable(value)
      ? value[toElement]()
      : typeof value === 'object' && isIterable(value)
        ? createFragment(value)
        : createBind(value);
}

function isBindable(value: any): value is Bindable {
  return typeof value?.[toElement] === 'function';
}

function isIterable(value: any): value is Iterable<unknown> {
  return typeof value?.[Symbol.iterator] === 'function';
}
