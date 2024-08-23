import type {} from './typings/scheduler.js';

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
  disconnect(context: UpdateContext<TContext>): void;
}

export interface Directive<TThis, TContext = unknown> {
  [directiveTag](
    this: TThis,
    part: Part,
    context: DirectiveContext<TContext>,
  ): Binding<TThis, TContext>;
}

export interface DirectiveContext<TContext = unknown> {
  get block(): Block<TContext> | null;
}

export interface Block<TContext> {
  get parent(): Block<TContext> | null;
  get priority(): TaskPriority;
  get isUpdating(): boolean;
  shouldUpdate(): boolean;
  cancelUpdate(): void;
  requestUpdate(priority: TaskPriority, context: UpdateContext<TContext>): void;
  update(context: UpdateContext<TContext>): void;
}

// Re-export TaskPriority in Scheduler API.
export type TaskPriority = globalThis.TaskPriority;

export type ComponentType<TProps, TData, TContext> = (
  props: TProps,
  context: TContext,
) => TemplateDirective<TData, TContext>;

export interface UpdateQueue<TContext> {
  blocks: Block<TContext>[];
  mutationEffects: Effect[];
  layoutEffects: Effect[];
  passiveEffects: Effect[];
}

export interface UpdateRuntime<TContext> {
  beginRender(
    updater: Updater<TContext>,
    block: Block<TContext>,
    queue: UpdateQueue<TContext>,
    hooks: Hook[],
  ): TContext;
  finishRender(context: TContext): void;
  flushEffects(effects: Effect[], phase: CommitPhase): void;
  getCurrentPriority(): TaskPriority;
  getHTMLTemplate<TData extends readonly any[]>(
    tokens: TemplateStringsArray,
    data: TData,
  ): Template<TData>;
  getHostName(): string;
  getSVGTemplate<TData extends readonly any[]>(
    tokens: TemplateStringsArray,
    data: TData,
  ): Template<TData>;
  getScopedValue(key: unknown, block?: Block<TContext> | null): unknown;
  mount<TValue>(
    value: TValue,
    container: ChildNode,
    updater: Updater<TContext>,
  ): () => void;
  nextIdentifier(): number;
  setScopedValue(key: unknown, value: unknown, block: Block<TContext>): void;
}

export interface Updater<TContext> {
  isScheduled(): boolean;
  flushUpdate(
    queue: UpdateQueue<TContext>,
    host: UpdateRuntime<TContext>,
  ): void;
  scheduleUpdate(
    queue: UpdateQueue<TContext>,
    host: UpdateRuntime<TContext>,
  ): void;
  waitForUpdate(): Promise<void>;
}

export interface Template<TData, TContext = unknown> {
  render(
    data: TData,
    context: DirectiveContext<TContext>,
  ): TemplateView<TData, TContext>;
  isSameTemplate(other: Template<TData, TContext>): boolean;
}

export interface TemplateDirective<TData = unknown, TContext = unknown>
  extends Directive<TemplateDirective<TData, TContext>, TContext> {
  get template(): Template<TData, TContext>;
  get data(): TData;
}

export interface TemplateView<TData, TContext = unknown> {
  get startNode(): ChildNode | null;
  get endNode(): ChildNode | null;
  connect(context: UpdateContext<TContext>): void;
  bind(data: TData, context: UpdateContext<TContext>): void;
  unbind(context: UpdateContext<TContext>): void;
  disconnect(context: UpdateContext<TContext>): void;
  mount(part: ChildNodePart): void;
  unmount(part: ChildNodePart): void;
}

export interface Effect {
  commit(phase: CommitPhase): void;
}

export enum CommitPhase {
  Mutation,
  Layout,
  Passive,
}

export enum CommitStatus {
  Committed,
  Mounting,
  Unmounting,
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
  | IdentifierHook
  | MemoHook<any>
  | ReducerHook<any, any>
  | FinalizerHook;

export enum HookType {
  InsertionEffect,
  LayoutEffect,
  PassiveEffect,
  Identifier,
  Memo,
  Reducer,
  Finalizer,
}

export interface EffectHook {
  type:
    | HookType.InsertionEffect
    | HookType.LayoutEffect
    | HookType.PassiveEffect;
  callback: EffectCallback;
  cleanup: Cleanup | void;
  dependencies: unknown[] | undefined;
}

export interface IdentifierHook {
  type: HookType.Identifier;
  id: number;
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

export type RefCallback<T> = (value: T) => Cleanup | void;

export interface RefObject<T> {
  current: T;
}

export class UpdateContext<TContext = unknown> {
  private _host: UpdateRuntime<TContext>;

  private _updater: Updater<TContext>;

  private _block: Block<TContext>;

  private _queue: UpdateQueue<TContext>;

  constructor(
    host: UpdateRuntime<TContext>,
    updater: Updater<TContext>,
    block: Block<TContext>,
    queue: UpdateQueue<TContext> = createUpdateQueue(),
  ) {
    this._host = host;
    this._updater = updater;
    this._block = block;
    this._queue = queue;
  }

  get host(): UpdateRuntime<TContext> {
    return this._host;
  }

  get updater(): Updater<TContext> {
    return this._updater;
  }

  get block(): Block<TContext> {
    return this._block;
  }

  /**
   * @internal
   */
  get queue(): UpdateQueue<TContext> {
    return this._queue;
  }

  enqueueBlock(block: Block<TContext>): void {
    this._queue.blocks.push(block);
  }

  enqueueMutationEffect(effect: Effect): void {
    this._queue.mutationEffects.push(effect);
  }

  enqueueLayoutEffect(effect: Effect): void {
    this._queue.layoutEffects.push(effect);
  }

  enqueuePassiveEffect(effect: Effect): void {
    this._queue.passiveEffects.push(effect);
  }

  flushUpdate(): void {
    this._updater.flushUpdate(this._queue, this._host);
  }

  isPending(): boolean {
    return (
      this._updater.isScheduled() ||
      this._queue.blocks.length > 0 ||
      this._queue.mutationEffects.length > 0 ||
      this._queue.layoutEffects.length > 0 ||
      this._queue.passiveEffects.length > 0
    );
  }

  renderComponent<TProps, TData>(
    type: ComponentType<TProps, TData, TContext>,
    props: TProps,
    hooks: Hook[],
  ): TemplateDirective<TData, TContext> {
    const context = this._host.beginRender(
      this._updater,
      this._block,
      this._queue,
      hooks,
    );
    const result = type(props, context);

    this._host.finishRender(context);

    return result;
  }

  scheduleUpdate(): void {
    this._updater.scheduleUpdate(this._queue, this._host);
  }
}

export function createUpdateQueue<TContext>(
  blocks: Block<TContext>[] = [],
  mutationEffects: Effect[] = [],
  layoutEffects: Effect[] = [],
  passiveEffects: Effect[] = [],
): UpdateQueue<TContext> {
  return {
    blocks,
    mutationEffects,
    layoutEffects,
    passiveEffects,
  };
}

export function isDirective<TValue>(
  value: TValue,
): value is TValue & Directive<TValue> {
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
  return JSON.stringify(value);
}
