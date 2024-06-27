export interface Updater<TContext = unknown> {
  getCurrentBlock(): Block<TContext> | null;
  getCurrentPriority(): TaskPriority;
  isPending(): boolean;
  isScheduled(): boolean;
  waitForUpdate(): Promise<void>;
  enqueueBlock(block: Block<TContext>): void;
  enqueueLayoutEffect(effect: Effect): void;
  enqueueMutationEffect(effect: Effect): void;
  enqueuePassiveEffect(effect: Effect): void;
  scheduleUpdate(): void;
}

export interface UpdateContext<TContext> {
  flushEffects(effects: Effect[], mode: EffectMode): void;
  renderComponent<TProps, TData>(
    component: Component<TProps, TData, TContext>,
    props: TProps,
    hooks: Hook[],
    block: Block<TContext>,
    updater: Updater<TContext>,
  ): TemplateResult<TData, TContext>;
}

export interface Block<TContext = unknown> {
  get dirty(): boolean;
  get parent(): Block<TContext> | null;
  get priority(): TaskPriority;
  shouldUpdate(): boolean;
  requestUpdate(priority: TaskPriority, updater: Updater<TContext>): void;
  update(context: UpdateContext<TContext>, updater: Updater<TContext>): void;
}

export type Component<TProps, TData, TContext> = (
  props: TProps,
  context: TContext,
) => TemplateResult<TData, TContext>;

export interface Template<TData, TContext = unknown> {
  hydrate(
    data: TData,
    updater: Updater<TContext>,
  ): TemplateFragment<TData, TContext>;
  isSameTemplate(other: Template<TData, TContext>): boolean;
}

export interface TemplateFragment<TData, TContext = unknown> {
  get startNode(): ChildNode | null;
  get endNode(): ChildNode | null;
  attach(data: TData, updater: Updater<TContext>): void;
  detach(updater: Updater): void;
  mount(part: ChildNodePart): void;
  unmount(part: ChildNodePart): void;
  disconnect(): void;
}

export interface TemplateResult<TData, TContext> {
  get template(): Template<TData, TContext>;
  get data(): TData;
}

export interface Effect {
  commit(mode: EffectMode): void;
}

export type EffectMode = 'mutation' | 'layout' | 'passive';

export type Part =
  | AttributePart
  | ChildNodePart
  | ElementPart
  | EventPart
  | NodePart
  | PropertyPart;

export enum PartType {
  Attribute,
  ChildNode,
  Element,
  Event,
  Node,
  Property,
}

export interface AttributePart {
  type: PartType.Attribute;
  node: Element;
  name: string;
}

export interface ChildNodePart {
  type: PartType.ChildNode;
  node: ChildNode;
}

export interface ElementPart {
  type: PartType.Element;
  node: Element;
}

export interface EventPart {
  type: PartType.Event;
  node: Element;
  name: string;
}

export interface PropertyPart {
  type: PartType.Property;
  node: Element;
  name: string;
}

export interface NodePart {
  type: PartType.Node;
  node: ChildNode;
}

export type Hook =
  | EffectHook
  | MemoHook<any>
  | ReducerHook<any, any>
  | FinilizerHook;

export enum HookType {
  Effect,
  Memo,
  Reducer,
  Finalizer,
}

export interface EffectHook {
  type: HookType.Effect;
  cleanup: Cleanup | void;
  dependencies: unknown[] | undefined;
}

export interface MemoHook<TResult> {
  type: HookType.Memo;
  value: TResult;
  dependencies: unknown[] | undefined;
}

export interface ReducerHook<TState, TAction> {
  type: HookType.Reducer;
  dispatch: (action: TAction) => void;
  state: TState;
}

export interface FinilizerHook {
  type: HookType.Finalizer;
}

export type Cleanup = () => void;

export type EffectCallback = () => Cleanup | void;

export type Ref<T> = RefCallback<T> | RefObject<T>;

export type RefCallback<T> = (value: T) => void;

export interface RefObject<T> {
  current: T;
}

// Reexport TaskPriority in Scheduler API.
export type TaskPriority = 'user-blocking' | 'user-visible' | 'background';
