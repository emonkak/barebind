import { type Binding, type Directive, directiveTag } from '../src/binding.js';
import type {
  RequestCallbackOptions,
  Scheduler,
  YieldToMainOptions,
} from '../src/scheduler.js';
import type {
  Block,
  ChildNodePart,
  Component,
  Effect,
  EffectMode,
  Hook,
  Part,
  TaskPriority,
  Template,
  TemplateFragment,
  TemplateResult,
  UpdateContext,
  Updater,
} from '../src/types.js';

export class MockBinding implements Binding<MockDirective> {
  private _value: MockDirective;

  private readonly _part: Part;

  constructor(value: MockDirective, part: Part) {
    this._value = value;
    this._part = part;
  }

  get value(): MockDirective {
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

  bind(newValue: MockDirective, _updater: Updater): void {
    this._value = newValue;
  }

  connect(_updater: Updater): void {}

  unbind(_updater: Updater): void {}

  disconnect(): void {}
}

export class MockBlock<TContext> implements Block<TContext> {
  private _parent: Block<TContext> | null;

  constructor(parent: Block<TContext> | null = null) {
    this._parent = parent;
  }

  get dirty(): boolean {
    return false;
  }

  get parent(): Block<TContext> | null {
    return this._parent;
  }

  get priority(): TaskPriority {
    return 'user-visible';
  }

  shouldUpdate(): boolean {
    return true;
  }

  requestUpdate(_priority: TaskPriority, _updater: Updater<TContext>): void {}

  update(
    _context: UpdateContext<TContext>,
    _updater: Updater<TContext>,
  ): void {}
}

export class MockDirective implements Directive {
  [directiveTag](part: Part, _updater: Updater): MockBinding {
    return new MockBinding(this, part);
  }
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

export class MockRenderingContext {}

export class MockRenderingEngine
  implements UpdateContext<MockRenderingContext>
{
  flushEffects(effects: Effect[], mode: EffectMode): void {
    for (let i = 0, l = effects.length; i < l; i++) {
      effects[i]!.commit(mode);
    }
  }

  renderComponent<TProps, TData>(
    component: Component<TProps, TData, MockRenderingContext>,
    props: TProps,
    _hooks: Hook[],
    _block: Block<MockRenderingContext>,
    _updater: Updater<MockRenderingContext>,
  ): TemplateResult<TData, MockRenderingContext> {
    return component(props, new MockRenderingContext());
  }
}

export class MockTemplate<TData, TContext>
  implements Template<TData, TContext>
{
  hydrate(
    _data: TData,
    _updater: Updater<TContext>,
  ): MockTemplateFragment<TData, TContext> {
    return new MockTemplateFragment();
  }

  isSameTemplate(other: Template<TData, TContext>): boolean {
    return this === other;
  }
}

export class MockTemplateFragment<TData, TContext>
  implements TemplateFragment<TData, TContext>
{
  get startNode(): ChildNode | null {
    return null;
  }

  get endNode(): ChildNode | null {
    return null;
  }

  bind(_data: TData, _updater: Updater<TContext>): void {}

  unbind(_updater: Updater): void {}

  mount(_part: ChildNodePart): void {}

  unmount(_part: ChildNodePart): void {}

  disconnect(): void {}
}

export class MockTemplateResult<TData, TContext>
  implements TemplateResult<TData, TContext>
{
  private _template: Template<TData, TContext>;

  private _data: TData;

  constructor(template: Template<TData, TContext>, data: TData) {
    this._template = template;
    this._data = data;
  }

  get template(): Template<TData, TContext> {
    return this._template;
  }
  get data(): TData {
    return this._data;
  }
}
