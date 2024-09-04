/// <reference path="../typings/scheduler.d.ts" />

export const directiveTag = Symbol('Directive');

export const nameTag = Symbol('name');

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
) => TemplateResult<TData, TContext>;

export interface UpdateQueue<TContext> {
  blocks: Block<TContext>[];
  mutationEffects: Effect[];
  layoutEffects: Effect[];
  passiveEffects: Effect[];
}

export interface RenderHost<TContext> {
  beginRender(
    updater: Updater<TContext>,
    block: Block<TContext>,
    queue: UpdateQueue<TContext>,
    hooks: Hook[],
  ): TContext;
  finishRender(context: TContext): void;
  flushEffects(effects: Effect[], phase: CommitPhase): void;
  getCurrentPriority(): TaskPriority;
  getHTMLTemplateResult<TData extends readonly any[]>(
    strings: TemplateStringsArray,
    data: TData,
  ): TemplateResult<TData, TContext>;
  getHostName(): string;
  getSVGTemplateResult<TData extends readonly any[]>(
    strings: TemplateStringsArray,
    data: TData,
  ): TemplateResult<TData, TContext>;
  getScopedValue(key: unknown, block?: Block<TContext> | null): unknown;
  getUnsafeHTMLTemplateResult(
    content: string,
  ): TemplateResult<readonly [], TContext>;
  getUnsafeSVGTemplateResult(
    content: string,
  ): TemplateResult<readonly [], TContext>;
  nextIdentifier(): number;
  resolveBinding<TValue>(value: TValue, part: Part): Binding<TValue, TContext>;
  setScopedValue(key: unknown, value: unknown, block: Block<TContext>): void;
}

export interface Updater<TContext> {
  isScheduled(): boolean;
  flushUpdate(queue: UpdateQueue<TContext>, host: RenderHost<TContext>): void;
  scheduleUpdate(
    queue: UpdateQueue<TContext>,
    host: RenderHost<TContext>,
  ): void;
  waitForUpdate(): Promise<void>;
}

export interface Template<TData, TContext = unknown> {
  render(
    data: TData,
    context: DirectiveContext<TContext>,
  ): TemplateView<TData, TContext>;
  isSameTemplate(other: Template<unknown, TContext>): boolean;
}

export interface TemplateResult<TData = unknown, TContext = unknown> {
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

export interface DirectiveContext<TContext = unknown> {
  readonly host: RenderHost<TContext>;
  readonly block: Block<TContext> | null;
}

export class UpdateContext<TContext = unknown> {
  constructor(
    public readonly host: RenderHost<TContext>,
    public readonly updater: Updater<TContext>,
    public readonly block: Block<TContext>,
    /**
     * @internal
     */
    public readonly queue: UpdateQueue<TContext> = createUpdateQueue(),
  ) {}

  enqueueBlock(block: Block<TContext>): void {
    this.queue.blocks.push(block);
  }

  enqueueMutationEffect(effect: Effect): void {
    this.queue.mutationEffects.push(effect);
  }

  enqueueLayoutEffect(effect: Effect): void {
    this.queue.layoutEffects.push(effect);
  }

  enqueuePassiveEffect(effect: Effect): void {
    this.queue.passiveEffects.push(effect);
  }

  flushUpdate(): void {
    this.updater.flushUpdate(this.queue, this.host);
  }

  isPending(): boolean {
    return (
      this.updater.isScheduled() ||
      this.queue.blocks.length > 0 ||
      this.queue.mutationEffects.length > 0 ||
      this.queue.layoutEffects.length > 0 ||
      this.queue.passiveEffects.length > 0
    );
  }

  render<TProps, TData>(
    type: ComponentType<TProps, TData, TContext>,
    props: TProps,
    hooks: Hook[],
  ): TemplateResult<TData, TContext> {
    const context = this.host.beginRender(
      this.updater,
      this.block,
      this.queue,
      hooks,
    );
    const result = type(props, context);

    this.host.finishRender(context);

    return result;
  }

  scheduleUpdate(): void {
    this.updater.scheduleUpdate(this.queue, this.host);
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

export function resolveBinding<TValue, TContext>(
  value: TValue,
  part: Part,
  context: DirectiveContext<TContext>,
): Binding<TValue, TContext> {
  if (isDirective(value)) {
    return value[directiveTag](part, context);
  } else {
    return context.host.resolveBinding(value, part);
  }
}
