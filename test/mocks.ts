import {
  type Binding,
  type Block,
  type ChildNodePart,
  type CommitPhase,
  CommitStatus,
  type ComponentType,
  type Directive,
  type DirectiveContext,
  type Effect,
  type Hook,
  type Part,
  PartType,
  type RenderFrame,
  type RenderHost,
  type TaskPriority,
  type Template,
  type TemplateMode,
  type TemplateResult,
  type TemplateView,
  type UpdateContext,
  type Updater,
  directiveTag,
} from '../src/baseTypes.js';
import { AttributeBinding } from '../src/bindings/attribute.js';
import { ElementBinding } from '../src/bindings/element.js';
import { EventBinding } from '../src/bindings/event.js';
import { NodeBinding } from '../src/bindings/node.js';
import { PropertyBinding } from '../src/bindings/property.js';
import { LiteralProcessor } from '../src/literal.js';
import {
  RenderContext,
  type UsableObject,
  usableTag,
} from '../src/renderContext.js';
import type { RequestCallbackOptions, Scheduler } from '../src/scheduler.js';

export class MockBinding<T> implements Binding<T> {
  private _value: T;

  private readonly _part: Part;

  constructor(value: T, part: Part) {
    this._value = value;
    this._part = part;
  }

  get value(): T {
    return this._value;
  }

  get part(): Part {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  connect(_context: UpdateContext): void {}

  bind(newValue: T, _context: UpdateContext): void {
    this._value = newValue;
  }

  unbind(_context: UpdateContext): void {}

  disconnect(_context: UpdateContext): void {}
}

export class MockBlock<TContext> implements Block<TContext> {
  private readonly _binding: Binding<unknown, TContext>;

  private readonly _parent: Block<TContext> | null;

  constructor(value: unknown = null, parent: Block<TContext> | null = null) {
    this._binding = new MockBinding(value, {
      type: PartType.ChildNode,
      node: document.createComment(''),
    });
    this._parent = parent;
  }

  get binding(): Binding<unknown, TContext> {
    return this._binding;
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

export class MockTemplate<TValues, TContext>
  implements Template<TValues, TContext>
{
  render(
    values: TValues,
    _context: UpdateContext<TContext>,
  ): MockTemplateView<TValues, TContext> {
    return new MockTemplateView(values);
  }

  isSameTemplate(other: Template<unknown>): boolean {
    return other === this;
  }

  wrapInResult(values: TValues): TemplateResult<TValues, TContext> {
    return {
      template: this,
      values,
    };
  }
}

export class MockTemplateView<TValues, TContext>
  implements TemplateView<TValues, TContext>
{
  private _values: TValues;

  private readonly _childNodes: ChildNode[];

  constructor(values: TValues, childNodes: ChildNode[] = []) {
    this._values = values;
    this._childNodes = childNodes;
  }

  get startNode(): ChildNode | null {
    return this._childNodes[0] ?? null;
  }

  get endNode(): ChildNode | null {
    return this._childNodes.at(-1) ?? null;
  }

  get values(): TValues {
    return this._values;
  }

  connect(_context: UpdateContext<TContext>): void {}

  bind(values: TValues, _context: UpdateContext<TContext>): void {
    this._values = values;
  }

  unbind(_context: UpdateContext<TContext>): void {}

  mount(_part: ChildNodePart): void {}

  unmount(_part: ChildNodePart): void {}

  disconnect(_context: UpdateContext): void {}
}

export class MockRenderHost implements RenderHost<RenderContext> {
  private _idCounter = 0;

  private _literalProcessor = new LiteralProcessor();

  flushComponent<TProps, TValues>(
    type: ComponentType<TProps, TValues, RenderContext>,
    props: TProps,
    hooks: Hook[],
    updater: Updater<RenderContext>,
    block: Block<RenderContext>,
    frame: RenderFrame<RenderContext>,
  ): TemplateResult<TValues, RenderContext> {
    const context = new RenderContext(
      this,
      updater,
      block,
      frame,
      hooks,
      this._literalProcessor,
    );
    const result = type(props, context);
    context.finalize();
    return result;
  }

  flushEffects(effects: Effect[], phase: CommitPhase): void {
    for (let i = 0, l = effects.length; i < l; i++) {
      effects[i]!.commit(phase);
    }
  }

  getCurrentPriority(): TaskPriority {
    return 'user-blocking';
  }

  getHostName(): string {
    return '__test__';
  }

  getTemplate<TValues extends readonly any[]>(
    _strings: readonly string[],
    _values: TValues,
    _mode: TemplateMode,
  ): Template<TValues, RenderContext> {
    return new MockTemplate();
  }

  getScopedValue(_key: unknown, _block: Block<RenderContext>): unknown {
    return undefined;
  }

  getUnsafeTemplate(
    _content: string,
    _mode: TemplateMode,
  ): Template<[], RenderContext> {
    return new MockTemplate();
  }

  nextIdentifier(): number {
    return ++this._idCounter;
  }

  resolveBinding<TValue>(value: TValue, part: Part): Binding<TValue> {
    switch (part.type) {
      case PartType.Attribute:
        return new AttributeBinding(value, part);
      case PartType.ChildNode:
        return new NodeBinding(value, part);
      case PartType.Element:
        return new ElementBinding(value, part) as Binding<any, RenderContext>;
      case PartType.Event:
        return new EventBinding(value, part) as Binding<any, RenderContext>;
      case PartType.Node:
        return new NodeBinding(value, part);
      case PartType.Property:
        return new PropertyBinding(value, part);
    }
  }

  setScopedValue(
    _key: unknown,
    _value: unknown,
    _block: Block<RenderContext>,
  ): void {}

  startViewTransition(callback: () => void | Promise<void>): Promise<void> {
    return Promise.resolve().then(callback);
  }
}

export class MockUsableObject<T> implements UsableObject<T> {
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

  connect(context: UpdateContext): void {
    if (this._status === CommitStatus.Committed) {
      context.enqueueMutationEffect(this);
    }
    this._status = CommitStatus.Mounting;
  }

  bind(newValue: TextDirective, context: UpdateContext): void {
    if (this._status === CommitStatus.Committed) {
      context.enqueueMutationEffect(this);
    }
    this._value = newValue;
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
