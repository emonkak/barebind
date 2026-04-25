import { NoLanes } from './lane.js';

export const Bind = Symbol.for('barebind.Bind');
export const Directive = Symbol.for('barebind.Directive');
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
  newInstance(props: TProps, dispatcher: Dispatcher): ComponentInstance<TProps>;
}

export interface ComponentInstance<TProps> {
  connect(tree: RenderTree.ComponentNode<TProps>): void;
  render(tree: RenderTree.ComponentNode<TProps>): VElement;
  afterCommit(): void;
  beforeRemove(): void;
}

export interface Dispatcher {
  readonly flushLanes: Lanes;
  nextIdentifier(): string;
  nextTransition(): number;
  schedule(unit: UpdateUnit, options?: UpdateOptions): UpdateHandle;
}

export type Effect = () => void;

export interface HostAdapter {
  getIdentifier(): string;
  getTaskPriority(): TaskPriority;
  renderElement(element: VHostElement): HostNode;
  requestCommit(callback: () => void): Promise<void>;
  requestCallback<T>(
    callback: () => T | PromiseLike<T>,
    options?: SchedulerPostTaskOptions,
  ): Promise<T>;
  startViewTransition(callback: () => void): Promise<void>;
  yieldToMain(): Promise<void>;
}

export interface HostNode {
  get refInstance(): unknown;
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

export interface Injectable<TInstance, TDefault> {
  new (...args: never[]): TInstance;
  getDefault?(): TDefault;
}

export type Lane = number;

export type Lanes = number;

export type Mutation =
  | {
      type: typeof InsertType;
      tree: RenderTree;
      afterTree: RenderTree | undefined;
    }
  | {
      type: typeof UpdateType;
      oldTree: RenderTree;
      newTree: RenderTree;
    }
  | {
      type: typeof UpdateAndMoveType;
      oldTree: RenderTree;
      newTree: RenderTree;
      afterTree: RenderTree | undefined;
    }
  | {
      type: typeof RemoveType;
      tree: RenderTree;
    };

export interface Reconciler {
  diff(
    oldTree: RenderTree,
    newElement: VElement,
    scope: Scope,
    index?: number,
    parent?: RenderTree | null,
  ): RenderTree;
  nextRenderId(): number;
  render(
    element: VElement,
    scope: Scope,
    index?: number,
    parent?: RenderTree | null,
  ): RenderTree;
}

export type RenderTree =
  | RenderTree.ComponentNode
  | RenderTree.DirectiveNode
  | RenderTree.FragmentNode
  | RenderTree.NativeNode;

export namespace RenderTree {
  interface RenderNode<TElement extends VElement>
    extends Pick<TElement, 'type' | 'props' | 'key'> {
    id: number;
    index: number;
    parent: RenderTree | null;
    children: RenderTree[];
  }

  export interface DirectiveNode extends RenderNode<VDirective> {
    dirty: boolean;
    cleanup: (() => void) | void;
  }

  export interface ComponentNode<TProps = any> extends RenderNode<VComponent> {
    instance: ComponentInstance<TProps>;
    scope: Scope;
  }

  export interface FragmentNode extends RenderNode<VFragment> {
    mutations: Mutation[];
  }

  export interface NativeNode extends RenderNode<VHostElement> {
    hostNode: HostNode;
  }
}

export interface Renderable {
  [toElement](): VElement;
}

export type TemplateMode = 'html' | 'math' | 'svg' | 'textarea';

export interface UpdateHandle {
  id: number;
  lanes: Lanes;
  finished: Promise<void>;
}

export interface UpdateOptions
  extends Pick<SchedulerPostTaskOptions, 'delay' | 'priority'> {
  flushSync?: boolean;
  transition?: number;
  viewTransition?: boolean;
}

export interface UpdateUnit {
  readonly scope: Scope;
  prepare(reconciler: Reconciler): Effect;
}

export type VDirective<T = any> = VNode<
  typeof Directive,
  {
    setup: (instance: T) => (() => void) | void;
    deps: unknown[] | null | undefined;
  },
  []
>;

export type VElement = VDirective | VComponent | VFragment | VHostElement;

export type VBind = VNode<typeof Bind, { index: number }, [VElement]>;

export type VComponent<TProps = any> = VNode<ComponentType<TProps>, TProps, []>;

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

  [toElement](): VDirective<NonNullable<T>> {
    return createDirective(
      (instance) => {
        this.current = instance as T;
        return () => {
          this.current = null as T;
        };
      },
      [this],
    );
  }
}

export class Scope {
  parent: Scope | null;
  level: number;
  pendingLanes: Lanes;
  instances: object[] = [];

  constructor(parent: Scope | null = null, pendingLanes: Lanes = NoLanes) {
    this.parent = parent;
    this.level = (parent?.level ?? -1) + 1;
    this.pendingLanes = pendingLanes;
  }
}

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
    DEBUG: {
      Object.freeze(this);
    }
  }

  withKey(key: unknown): VNode<TType, TProps, TChildren> {
    return new VNode(this.type, this.props, this.children, key);
  }
}

export function createDirective<T>(
  setup: (instance: T) => (() => void) | void,
  deps?: unknown[] | null | undefined,
): VDirective<T> {
  return new VNode(Directive, { setup, deps }, []);
}

export function createPortal(value: unknown, container: Element): VPortal {
  return new VNode(container, {}, [wrap(value)]);
}

export function wrap(value: unknown): VElement {
  return value instanceof VNode
    ? value
    : isRenderable(value)
      ? value[toElement]()
      : typeof value === 'object' && isIterable(value)
        ? new VNode(Fragment, {}, Array.from(value, wrap))
        : new VNode(Primitive, { value }, []);
}

function isIterable(value: any): value is Iterable<unknown> {
  return typeof value?.[Symbol.iterator] === 'function';
}

function isRenderable(value: any): value is Renderable {
  return typeof value?.[toElement] === 'function';
}
