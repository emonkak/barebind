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
  newHandle(props: TProps, dispatcher: Dispatcher): ComponentHandle<TProps>;
}

export interface ComponentHandle<TProps> {
  skipUpdate(view: View.ComponentView<TProps>): void;
  update(
    view: View.ComponentView<TProps>,
    lanes: Lanes,
    reconciler: Reconciler,
  ): void;
  afterCommit(): void;
  beforeRemove(): void;
}

export interface ComponentInstance<TProps> {
  handle: ComponentHandle<TProps>;
  pendingLanes: Lanes;
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

export interface Injectable<TInstance, TDefault> {
  new (...args: never[]): TInstance;
  getDefault?(): TDefault;
}

export type Lane = number;

export type Lanes = number;

export type Mutation =
  | {
      type: typeof InsertType;
      view: View;
      afterView: View | undefined;
    }
  | {
      type: typeof UpdateType;
      oldView: View;
      newView: View;
    }
  | {
      type: typeof UpdateAndMoveType;
      oldView: View;
      newView: View;
      afterView: View | undefined;
    }
  | {
      type: typeof RemoveType;
      view: View;
    };

export interface Reconciler {
  diff(
    oldView: View,
    newElement: VElement,
    scope: Scope,
    index: number,
    parent: View | null,
  ): View;
  nextRenderId(): number;
  render(
    element: VElement,
    scope: Scope,
    index?: number,
    parent?: View | null,
  ): View;
}

export type View =
  | View.ComponentView
  | View.DirectiveView
  | View.FragmentView
  | View.HostView;

export namespace View {
  interface BaseView<TElement extends VElement>
    extends Pick<TElement, 'type' | 'props' | 'key'> {
    id: number;
    index: number;
    parent: View | null;
    children: View[];
  }

  export interface DirectiveView extends BaseView<VDirective> {
    dirty: boolean;
    cleanup: (() => void) | void;
  }

  export interface ComponentView<TProps = any> extends BaseView<VComponent> {
    instance: ComponentInstance<TProps>;
    scope: Scope;
  }

  export interface FragmentView extends BaseView<VFragment> {
    mutations: Mutation[];
  }

  export interface HostView extends BaseView<VHostElement> {
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
  readonly pendingLanes: Lanes;
  prepare(lanes: Lanes, reconciler: Reconciler): Effect;
}

export type VBind = VNode<typeof Bind, { index: number }, [VElement]>;

export type VComponent<TProps = any> = VNode<ComponentType<TProps>, TProps, []>;

export type VDirective<T = any> = VNode<
  typeof Directive,
  {
    setup: (node: T) => (() => void) | void;
    deps: unknown[] | null | undefined;
  },
  []
>;

export type VElement = VComponent | VDirective | VFragment | VHostElement;

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
      (node) => {
        this.current = node as T;
        return () => {
          this.current = null as T;
        };
      },
      [this],
    );
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

  append(): Scope {
    return new Scope(this, this.level + 1);
  }

  clone(): Scope {
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

export function createDirective<T>(
  setup: (node: T) => (() => void) | void,
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
