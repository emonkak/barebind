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

export interface Boundary<TInstance, TDefault> {
  new (...args: never[]): TInstance;
  getDefault?(): TDefault;
}

export interface ComponentType<TProps> {
  (props: TProps): VComponent<TProps>;
  arePropsEqual(oldProps: TProps, newProps: TProps): boolean;
  newInstance(
    props: TProps,
    scheduler: UpdateScheduler,
  ): ComponentInstance<TProps>;
}

export interface ComponentInstance<TProps> {
  render(tree: RenderChild.ComponentChild<TProps>): VElement;
  afterCommit(): void;
  beforeRemove(): void;
}

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

export type HostTree = RenderRoot | RenderChild.HostChild;

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
  diff(oldTree: RenderRoot, element: VElement, scope: Scope): RenderRoot;
  diff(oldTree: RenderChild, newElement: VElement, scope: Scope): RenderChild;
  diff(oldTree: RenderTree, newElement: VElement, scope: Scope): RenderTree;
  render(element: VElement, scope: Scope): RenderRoot;
  render(
    element: VElement,
    scope: Scope,
    index: number,
    parent: RenderTree,
  ): RenderChild;
  render(
    element: VElement,
    scope: Scope,
    index: number,
    parent: RenderTree | null,
  ): RenderTree;
}

export type RenderChild =
  | RenderChild.ComponentChild
  | RenderChild.DirectiveChild
  | RenderChild.FragmentChild
  | RenderChild.HostChild;

export interface RenderNode<TElement extends VElement>
  extends Pick<TElement, 'type' | 'props' | 'key'> {
  parent: RenderTree | null;
  children: RenderChild[];
  index: number;
}

export namespace RenderChild {
  export interface DirectiveChild extends RenderNode<VDirective> {
    parent: RenderTree;
    dirty: boolean;
    cleanup: (() => void) | undefined;
  }

  export interface ComponentChild<TProps = any> extends RenderNode<VComponent> {
    parent: RenderTree;
    instance: ComponentInstance<TProps>;
    scope: Scope;
  }

  export interface FragmentChild extends RenderNode<VFragment> {
    parent: RenderTree;
    mutations: Mutation[];
  }

  export interface HostChild extends RenderNode<VHostElement> {
    parent: RenderTree;
    hostNode: HostNode;
  }
}

export interface RenderRoot extends RenderNode<VPortal> {
  parent: null;
  hostNode: HostNode;
}

export type RenderTree = RenderRoot | RenderChild;

export interface Renderable {
  [toElement](): VElement;
}

export interface Scope {
  parent: Scope | null;
  level: number;
  instances: object[];
  pendingLanes: Lanes;
}

export type TemplateMode = 'html' | 'math' | 'svg' | 'textarea';

export interface UpdateHandle {
  id: number;
  lanes: Lanes;
  finished: Promise<UpdateResult>;
}

export interface UpdateOptions
  extends Pick<SchedulerPostTaskOptions, 'delay' | 'priority'> {
  flushSync?: boolean;
  transition?: number;
  viewTransition?: boolean;
}

export type UpdateResult =
  | { status: 'done' }
  | { status: 'skipped' }
  | { status: 'intrupted'; reason: unknown };

export interface UpdateScheduler {
  readonly flushLanes: Lanes;
  nextIdentifier(): string;
  nextTransition(): number;
  schedule(unit: UpdateUnit, options?: UpdateOptions): UpdateHandle;
}

export interface UpdateUnit {
  readonly scope: Scope;
  prepare(reconciler: Reconciler): () => void;
}

export type VDirective<T = any> = VNode<
  typeof Directive,
  {
    setup: (instance: T) => (() => void) | undefined;
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
  setup: (instance: T) => (() => void) | undefined,
  deps?: unknown[] | null | undefined,
): VDirective<T> {
  return new VNode(Directive, { setup, deps }, []);
}

export function createPortal(child: unknown, container: Element): VPortal {
  return new VNode(container, {}, [wrap(child)]);
}

export function createScope(parent: Scope | null = null): Scope {
  return {
    parent,
    level: (parent?.level ?? -1) + 1,
    instances: [],
    pendingLanes: NoLanes,
  };
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
