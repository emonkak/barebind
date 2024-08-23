import {
  type Binding,
  type Block,
  type ChildNodePart,
  type CommitPhase,
  CommitStatus,
  type Directive,
  type DirectiveContext,
  type Effect,
  type Hook,
  type Part,
  type TaskPriority,
  type Template,
  type TemplateView,
  type UpdateContext,
  type UpdateQueue,
  type UpdateRuntime,
  type Updater,
  directiveTag,
} from '../src/baseTypes.js';
import {
  RenderContext,
  type UsableObject,
  usableTag,
} from '../src/renderContext.js';
import type { RequestCallbackOptions, Scheduler } from '../src/scheduler.js';

export class MockBlock<TContext> implements Block<TContext> {
  private _parent: Block<TContext> | null;

  constructor(parent: Block<TContext> | null = null) {
    this._parent = parent;
  }

  get isConnected(): boolean {
    return false;
  }

  get isUpdating(): boolean {
    return false;
  }

  get parent(): Block<TContext> | null {
    return this._parent;
  }

  get priority(): TaskPriority {
    return 'user-blocking';
  }

  cancelUpdate(): void {}

  shouldUpdate(): boolean {
    return true;
  }

  requestUpdate(
    _priority: TaskPriority,
    _context: UpdateContext<TContext>,
  ): void {}

  update(_context: UpdateContext<TContext>): void {}
}

export class MockScheduler implements Scheduler {
  getCurrentTime(): number {
    return Date.now();
  }

  requestCallback(
    callback: () => void,
    _options?: RequestCallbackOptions,
  ): void {
    queueMicrotask(callback);
  }

  shouldYieldToMain(_elapsedTime: number): boolean {
    return false;
  }

  yieldToMain(): Promise<void> {
    return Promise.resolve();
  }
}

export class MockTemplate<TData, TContext>
  implements Template<TData, TContext>
{
  render(
    data: TData,
    _context: UpdateContext<TContext>,
  ): MockTemplateView<TData, TContext> {
    return new MockTemplateView(data);
  }

  isSameTemplate(other: Template<TData, TContext>): boolean {
    return other === this;
  }
}

export class MockTemplateView<TData, TContext>
  implements TemplateView<TData, TContext>
{
  private _data: TData;

  private readonly _childNodes: ChildNode[];

  constructor(data: TData, childNodes: ChildNode[] = []) {
    this._data = data;
    this._childNodes = childNodes;
  }

  get startNode(): ChildNode | null {
    return this._childNodes[0] ?? null;
  }

  get endNode(): ChildNode | null {
    return this._childNodes.at(-1) ?? null;
  }

  get data(): TData {
    return this._data;
  }

  connect(_context: UpdateContext<TContext>): void {}

  bind(data: TData, _context: UpdateContext<TContext>): void {
    this._data = data;
  }

  unbind(_context: UpdateContext<TContext>): void {}

  mount(_part: ChildNodePart): void {}

  unmount(_part: ChildNodePart): void {}

  disconnect(_context: UpdateContext): void {}
}

export class MockUpdateHost implements UpdateRuntime<RenderContext> {
  private _idCounter = 0;

  beginRender(
    updater: Updater<RenderContext>,
    block: Block<RenderContext>,
    queue: UpdateQueue<RenderContext>,
    hooks: Hook[],
  ): RenderContext {
    return new RenderContext(this, updater, block, queue, hooks);
  }

  finishRender(context: RenderContext): void {
    context.finalize();
  }

  flushEffects(effects: Effect[], phase: CommitPhase): void {
    for (let i = 0, l = effects.length; i < l; i++) {
      effects[i]!.commit(phase);
    }
  }

  getCurrentPriority(): TaskPriority {
    return 'user-blocking';
  }

  getHTMLTemplate<TData extends readonly any[]>(
    _tokens: TemplateStringsArray,
    _data: TData,
  ): Template<TData> {
    return new MockTemplate();
  }

  getHostName(): string {
    return '__test__';
  }

  getSVGTemplate<TData extends readonly any[]>(
    _tokens: TemplateStringsArray,
    _data: TData,
  ): Template<TData> {
    return new MockTemplate();
  }

  getScopedValue(
    _key: unknown,
    _block: Block<RenderContext> | null = null,
  ): unknown {
    return undefined;
  }

  mount<TValue>(
    _value: TValue,
    _container: ChildNode,
    _updater: Updater<RenderContext>,
  ): () => void {
    return () => {};
  }

  nextIdentifier(): number {
    return ++this._idCounter;
  }

  setScopedValue(
    _key: unknown,
    _value: unknown,
    _block: Block<RenderContext>,
  ): void {}
}

export class MockUsableObject<T> implements UsableObject<T, unknown> {
  private _returnValue: T;

  constructor(returnValue: T) {
    this._returnValue = returnValue;
  }

  [usableTag](): T {
    return this._returnValue;
  }
}

export class TextBinding implements Binding<TextDirective>, Effect {
  private _value: TextDirective;

  private readonly _part: Part;

  private _status = CommitStatus.Committed;

  private _textNode: Text = document.createTextNode('');

  constructor(value: TextDirective, part: Part) {
    this._value = value;
    this._part = part;
  }

  get value(): TextDirective {
    return this._value;
  }

  get part(): Part {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._textNode.parentNode !== null
      ? this._textNode
      : this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  bind(newValue: TextDirective, context: UpdateContext): void {
    if (this._status === CommitStatus.Committed) {
      context.enqueueMutationEffect(this);
    }
    this._value = newValue;
    this._status = CommitStatus.Mounting;
  }

  connect(context: UpdateContext): void {
    if (this._status === CommitStatus.Committed) {
      context.enqueueMutationEffect(this);
    }
    this._status = CommitStatus.Mounting;
  }

  unbind(context: UpdateContext): void {
    if (this._status === CommitStatus.Committed) {
      context.enqueueMutationEffect(this);
    }
    this._status = CommitStatus.Unmounting;
  }

  disconnect(_context: UpdateContext): void {
    this._status = CommitStatus.Committed;
  }

  commit(): void {
    switch (this._status) {
      case CommitStatus.Mounting: {
        const { content } = this._value;
        this._textNode.data = content;
        if (this._textNode.parentNode === null) {
          this._part.node.before(this._textNode);
        }
        break;
      }
      case CommitStatus.Unmounting:
        this._textNode.remove();
        break;
    }

    this._status = CommitStatus.Committed;
  }
}

export class TextDirective implements Directive<TextDirective> {
  private _content: string;

  constructor(content = '') {
    this._content = content;
  }

  get content(): string {
    return this._content;
  }

  [directiveTag](
    part: Part,
    _context: DirectiveContext,
  ): Binding<TextDirective> {
    return new TextBinding(this, part);
  }
}
