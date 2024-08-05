import {
  type Binding,
  type Block,
  type ChildNodePart,
  type Directive,
  type DirectiveContext,
  type Effect,
  type EffectPhase,
  type Hook,
  type Part,
  type TaskPriority,
  type Template,
  type TemplateFragment,
  type UpdateContext,
  type UpdateHost,
  type UpdatePipeline,
  type Updater,
  directiveTag,
} from '../src/baseTypes.js';
import {
  RenderContext,
  type UsableObject,
  usableTag,
} from '../src/renderContext.js';
import type {
  RequestCallbackOptions,
  Scheduler,
  YieldToMainOptions,
} from '../src/scheduler.js';

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

  yieldToMain(_options?: YieldToMainOptions): Promise<void> {
    return Promise.resolve();
  }
}

export class MockTemplate<TData, TContext>
  implements Template<TData, TContext>
{
  render(
    data: TData,
    _context: UpdateContext<TContext>,
  ): MockTemplateFragment<TData, TContext> {
    return new MockTemplateFragment(data);
  }

  isSameTemplate(other: Template<TData, TContext>): boolean {
    return other === this;
  }
}

export class MockTemplateFragment<TData, TContext>
  implements TemplateFragment<TData, TContext>
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

  disconnect(): void {}
}

export class MockUpdateHost implements UpdateHost<RenderContext> {
  beginRender(
    updater: Updater<RenderContext>,
    block: Block<RenderContext>,
    hooks: Hook[],
    pipeline: UpdatePipeline<RenderContext>,
  ): RenderContext {
    return new RenderContext(this, updater, block, hooks, pipeline);
  }

  finishRender(context: RenderContext): void {
    context.finalize();
  }

  flushEffects(effects: Effect[], phase: EffectPhase): void {
    for (let i = 0, l = effects.length; i < l; i++) {
      effects[i]!.commit(phase);
    }
  }

  getCurrentPriority(): TaskPriority {
    return 'user-blocking';
  }

  getHTMLTemplate<TData extends readonly any[]>(
    _tokens: ReadonlyArray<string>,
    _data: TData,
  ): Template<TData> {
    return new MockTemplate();
  }

  getSVGTemplate<TData extends readonly any[]>(
    _tokens: ReadonlyArray<string>,
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

  private _text: Text = document.createTextNode('');

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
    return this._text.parentNode !== null ? this._text : this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  bind(newValue: TextDirective, context: UpdateContext<unknown>): void {
    this._value = newValue;
    context.enqueueMutationEffect(this);
  }

  connect(context: UpdateContext<unknown>): void {
    context.enqueueMutationEffect(this);
  }

  unbind(context: UpdateContext<unknown>): void {
    this._value = new TextDirective(null);
    context.enqueueMutationEffect(this);
  }

  disconnect(): void {}

  commit() {
    const { content } = this._value;

    this._text.nodeValue = content;

    if (content !== null) {
      this._part.node.before(this._text);
    } else {
      this._text.remove();
    }
  }
}

export class TextDirective implements Directive<TextDirective> {
  private _content: string | null;

  constructor(content: string | null = null) {
    this._content = content;
  }

  get content(): string | null {
    return this._content;
  }

  [directiveTag](part: Part, _context: DirectiveContext<unknown>): TextBinding {
    return new TextBinding(this, part);
  }
}
