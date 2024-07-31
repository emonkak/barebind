export const directiveTag = Symbol('Directive');

export const nameTag = Symbol('Name');

export interface Binding<TValue, TContext = unknown> {
  get value(): TValue;
  get part(): Part;
  get startNode(): ChildNode;
  get endNode(): ChildNode;
  connect(context: UpdateContext<TContext>): void;
  bind(newValue: TValue, context: UpdateContext<TContext>): void;
  unbind(context: UpdateContext<TContext>): void;
  disconnect(): void;
}

export interface Directive<TContext = unknown> {
  [directiveTag](
    part: Part,
    context: UpdateContext<TContext>,
  ): Binding<ThisType<this>, TContext>;
}

export interface Block<TContext> {
  get parent(): Block<TContext> | null;
  get priority(): TaskPriority;
  get isConnected(): boolean;
  get isUpdating(): boolean;
  shouldUpdate(): boolean;
  cancelUpdate(): void;
  requestUpdate(
    priority: TaskPriority,
    host: UpdateHost<TContext>,
    updater: Updater<TContext>,
  ): void;
  update(host: UpdateHost<TContext>, updater: Updater<TContext>): void;
}

// Reexport TaskPriority in Scheduler API.
export type TaskPriority = 'user-blocking' | 'user-visible' | 'background';

export type ComponentFunction<TProps, TData, TContext> = (
  props: TProps,
  context: TContext,
) => TemplateDirective<TData, TContext>;

export interface UpdateContext<TContext> {
  readonly host: UpdateHost<TContext>;
  readonly updater: Updater<TContext>;
  readonly currentBlock: Block<TContext> | null;
}

export interface UpdateHost<TContext> {
  beginRenderContext(
    hooks: Hook[],
    block: Block<TContext>,
    updater: Updater<TContext>,
  ): TContext;
  finishRenderContext(context: TContext): void;
  flushEffects(effects: Effect[], phase: EffectPhase): void;
  getCurrentPriority(): TaskPriority;
  getHTMLTemplate<TData extends readonly any[]>(
    tokens: ReadonlyArray<string>,
    data: TData,
  ): Template<TData>;
  getSVGTemplate<TData extends readonly any[]>(
    tokens: ReadonlyArray<string>,
    data: TData,
  ): Template<TData>;
  getScopedValue(key: unknown, block?: Block<TContext> | null): unknown;
  setScopedValue(key: unknown, value: unknown, block: Block<TContext>): void;
}

export interface Updater<TContext> {
  enqueueBlock(block: Block<TContext>): void;
  enqueueLayoutEffect(effect: Effect): void;
  enqueueMutationEffect(effect: Effect): void;
  enqueuePassiveEffect(effect: Effect): void;
  isPending(): boolean;
  isScheduled(): boolean;
  scheduleUpdate(host: UpdateHost<TContext>): void;
  waitForUpdate(): Promise<void>;
}

export interface Template<TData, TContext = unknown> {
  render(
    data: TData,
    context: UpdateContext<TContext>,
  ): TemplateFragment<TData, TContext>;
  isSameTemplate(other: Template<TData, TContext>): boolean;
}

export interface TemplateDirective<TData = unknown, TContext = unknown>
  extends Directive<TContext> {
  get template(): Template<TData, TContext>;
  get data(): TData;
}

export interface TemplateFragment<TData, TContext = unknown> {
  get startNode(): ChildNode | null;
  get endNode(): ChildNode | null;
  connect(context: UpdateContext<TContext>): void;
  bind(data: TData, context: UpdateContext<TContext>): void;
  unbind(context: UpdateContext<TContext>): void;
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

export function createUpdateContext<TContext>(
  host: UpdateHost<TContext>,
  updater: Updater<TContext>,
  currentBlock: Block<TContext> | null = null,
): UpdateContext<TContext> {
  return {
    host,
    updater,
    currentBlock,
  };
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
