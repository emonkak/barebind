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
import {
  type Binding,
  type Block,
  type ChildNodePart,
  type Directive,
  type Effect,
  type EffectPhase,
  type Hook,
  type Part,
  type TaskPriority,
  type Template,
  type TemplateFragment,
  type UpdateContext,
  type UpdateHost,
  type Updater,
  directiveTag,
} from '../src/types.js';

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
    _host: UpdateHost<TContext>,
    _updater: Updater<TContext>,
  ): void {}

  update(_host: UpdateHost<TContext>, _updater: Updater<TContext>): void {}
}

export class MockScheduler implements Scheduler {
  getCurrentTime(): number {
    return Date.now();
  }

  requestCallback(
    callback: () => void,
    _options?: RequestCallbackOptions,
  ): void {
    callback();
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
    hooks: Hook[],
    block: Block<RenderContext>,
    updater: Updater<RenderContext>,
  ): RenderContext {
    return new RenderContext(hooks, block, this, updater);
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

  bind(newValue: TextDirective, { updater }: UpdateContext<unknown>): void {
    this._value = newValue;
    updater.enqueueMutationEffect(this);
  }

  connect({ updater }: UpdateContext<unknown>): void {
    updater.enqueueMutationEffect(this);
  }

  unbind({ updater }: UpdateContext<unknown>): void {
    this._value = new TextDirective(null);
    updater.enqueueMutationEffect(this);
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

export class TextDirective implements Directive {
  private _content: string | null;

  constructor(content: string | null = null) {
    this._content = content;
  }

  get content(): string | null {
    return this._content;
  }

  [directiveTag](part: Part, _context: UpdateContext<unknown>): TextBinding {
    return new TextBinding(this, part);
  }
}
