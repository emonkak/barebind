export const directiveTag = Symbol('Directive');

export const nameTag = Symbol('Name');

export interface Binding<TValue, TContext = unknown> {
  get value(): TValue;
  get part(): Part;
  get startNode(): ChildNode;
  get endNode(): ChildNode;
  connect(updater: Updater<TContext>): void;
  bind(newValue: TValue, updater: Updater<TContext>): void;
  unbind(updater: Updater<TContext>): void;
  disconnect(): void;
}

export interface Directive<TContext = unknown> {
  [directiveTag](
    part: Part,
    updater: Updater<TContext>,
  ): Binding<ThisType<this>>;
}

export interface Updater<TContext = unknown> {
  getCurrentBlock(): UpdateBlock<TContext> | null;
  getCurrentPriority(): TaskPriority;
  isPending(): boolean;
  isScheduled(): boolean;
  waitForUpdate(): Promise<void>;
  enqueueBlock(block: UpdateBlock<TContext>): void;
  enqueueLayoutEffect(effect: Effect): void;
  enqueueMutationEffect(effect: Effect): void;
  enqueuePassiveEffect(effect: Effect): void;
  scheduleUpdate(): void;
}

export interface UpdateContext<TContext> {
  flushEffects(effects: Effect[], phase: EffectPhase): void;
  renderComponent<TProps>(
    component: ComponentFunction<TProps, TContext>,
    props: TProps,
    hooks: Hook[],
    block: UpdateBlock<TContext>,
    updater: Updater<TContext>,
  ): TemplateDirective<unknown, TContext>;
}

export interface UpdateBlock<TContext> {
  get parent(): UpdateBlock<TContext> | null;
  get priority(): TaskPriority;
  get isUpdating(): boolean;
  shouldUpdate(): boolean;
  cancelUpdate(): void;
  requestUpdate(priority: TaskPriority, updater: Updater<TContext>): void;
  performUpdate(
    context: UpdateContext<TContext>,
    updater: Updater<TContext>,
  ): void;
}

export type ComponentFunction<TProps, TContext> = (
  props: TProps,
  context: TContext,
) => TemplateDirective<unknown, TContext>;

export interface Template<TData, TContext = unknown> {
  render(
    data: TData,
    updater: Updater<TContext>,
  ): TemplateFragment<TData, TContext>;
  isSameTemplate(other: Template<TData, TContext>): boolean;
}

export interface TemplateDirective<TData, TContext>
  extends Directive<TContext> {
  get template(): Template<TData, TContext>;
  get data(): TData;
}

export interface TemplateFragment<TData, TContext = unknown> {
  get startNode(): ChildNode | null;
  get endNode(): ChildNode | null;
  bind(data: TData, updater: Updater<TContext>): void;
  unbind(updater: Updater): void;
  mount(part: ChildNodePart): void;
  unmount(part: ChildNodePart): void;
  disconnect(): void;
}

export interface Effect {
  commit(phase: EffectPhase): void;
}

export enum EffectPhase {
  Mutation,
  Layout,
  Passive,
}

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
  node: Comment;
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
  | FinalizerHook;

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

export interface FinalizerHook {
  type: HookType.Finalizer;
}

export type Cleanup = () => void;

export type EffectCallback = () => Cleanup | void;

export type RefValue<T> = RefCallback<T> | RefObject<T>;

export type RefCallback<T> = (value: T) => void;

export interface RefObject<T> {
  current: T;
}

// Reexport TaskPriority in Scheduler API.
export type TaskPriority = 'user-blocking' | 'user-visible' | 'background';

export function comparePriorities(
  first: TaskPriority,
  second: TaskPriority,
): number {
  return first === second
    ? 0
    : getPriorityNumber(second) - getPriorityNumber(first);
}

export function isDirective(value: unknown): value is Directive<unknown> {
  return value !== null && typeof value === 'object' && directiveTag in value;
}

export function nameOf(value: unknown): string {
  if (typeof value === 'object') {
    return value === null
      ? 'null'
      : nameTag in value
        ? (value[nameTag] as string)
        : value.constructor.name;
  }
  if (typeof value === 'function') {
    return value.name !== '' ? value.name : 'Function';
  }
  if (typeof value === 'undefined') {
    return 'undefined';
  }
  return value.toString();
}

function getPriorityNumber(priority: TaskPriority): number {
  switch (priority) {
    case 'user-blocking':
      return 0;
    case 'user-visible':
      return 1;
    case 'background':
      return 2;
  }
}
