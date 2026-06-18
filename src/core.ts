import { areDependenciesChange } from './compare.js';
import { NoLanes } from './lane.js';

// Mutation types
export const InsertType = 0;
export const UpdateType = 1;
export const UpdateAndMoveType = 2;
export const RemoveType = 3;

export const Bind = Symbol('Bind');
export const Fragment = Symbol('Fragment');
export const Primitive = Symbol('Primitive');

export interface Boundary<T extends object = object> {
  instance: T;
  next: Boundary<object> | null;
}

export interface BoundaryType<TInstance, TDefault> {
  new (...args: never[]): TInstance;
  getDefault?(): TDefault;
}

export interface ComponentType<TProps> {
  (props: TProps): VComponent<TProps>;
  arePropsEqual(oldProps: TProps, newProps: TProps): boolean;
  getInstance(
    props: TProps,
    scheduler: UpdateScheduler,
  ): ComponentInstance<TProps>;
}

export interface ComponentInstance<TProps> {
  render(origin: RenderChild.ComponentChild<TProps>): VElement;
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
  get refNode(): unknown;
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

export type RenderChild =
  | RenderChild.ComponentChild
  | RenderChild.FragmentChild
  | RenderChild.HostChild;

export namespace RenderChild {
  export interface ComponentChild<TProps = {}>
    extends Pick<VComponent<TProps>, 'type' | 'props' | 'key'> {
    parent: RenderTree;
    children: RenderChild[];
    index: number;
    instance: ComponentInstance<TProps>;
    scope: Scope;
  }

  export interface FragmentChild
    extends Pick<VFragment, 'type' | 'props' | 'key'> {
    parent: RenderTree;
    children: RenderChild[];
    index: number;
    mutations: Mutation[];
  }

  export interface HostChild
    extends Pick<VHostElement, 'type' | 'props' | 'key'> {
    parent: RenderTree;
    children: RenderChild[];
    index: number;
    hostNode: HostNode;
  }
}

export interface RenderRoot {
  type: VPortal['type'];
  props: VPortal['props'];
  key: VPortal['key'];
  children: RenderChild[];
  hostNode: HostNode;
  index: number;
  parent: null;
}

export type RenderTree = RenderRoot | RenderChild;

export interface Scope {
  parent: Scope | null;
  level: number;
  boundary: Boundary | null;
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
  triggerFlush?: boolean;
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
  schedule(
    node: RenderChild.ComponentChild,
    options?: UpdateOptions,
  ): UpdateHandle;
}

export type VElement = VComponent | VFragment | VHostElement;

export type VBind = VNode<typeof Bind, { index: number }, [VElement]>;

export type VComponent<TProps = {}> = VNode<ComponentType<TProps>, TProps, []>;

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

export function createPortal(child: unknown, container: Element): VPortal {
  return new VNode(container, {}, [toElement(child)]);
}

export function createScope(parent: Scope | null): Scope {
  return {
    parent,
    level: (parent?.level ?? -1) + 1,
    boundary: null,
    pendingLanes: NoLanes,
  };
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
