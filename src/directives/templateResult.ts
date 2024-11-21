import {
  type Binding,
  type ChildNodePart,
  CommitStatus,
  type DirectiveContext,
  type Effect,
  type Part,
  PartType,
  type Template,
  type TemplateResult,
  type TemplateView,
  type UpdateContext,
  directiveTag,
  nameOf,
} from '../baseTypes.js';
import { BlockBinding } from '../bindings/block.js';
import { ensureDirective, reportPart, reportUsedValue } from '../error.js';

export function eagerTemplateResult<
  const TData extends readonly any[],
  TContext,
>(
  template: Template<TData, TContext>,
  ...data: TData
): EagerTemplateResult<TData, TContext> {
  return new EagerTemplateResult(template, data);
}

export function lazyTemplateResult<
  const TData extends readonly any[],
  TContext,
>(
  template: Template<TData, TContext>,
  ...data: TData
): LazyTemplateResult<TData, TContext> {
  return new LazyTemplateResult(template, data);
}

abstract class AbstractTemplateResult<TData, TContext>
  implements TemplateResult<TData, TContext>
{
  protected readonly _template: Template<TData, TContext>;

  protected readonly _data: TData;

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

export class EagerTemplateResult<
  TData,
  TContext = unknown,
> extends AbstractTemplateResult<TData, TContext> {
  get [Symbol.toStringTag](): string {
    return `EagerTemplateResult(${nameOf(this._template)})`;
  }

  [directiveTag](
    part: Part,
    context: DirectiveContext,
  ): TemplateResultBinding<TData, TContext> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'EagerTemplateResult directive must be used in a child node, but it is used here in ' +
          nameOf(context.block?.binding.value ?? 'ROOT') +
          ':\n' +
          reportPart(part, reportUsedValue(this)),
      );
    }
    return new TemplateResultBinding(this, part);
  }
}

export class LazyTemplateResult<
  TData,
  TContext = unknown,
> extends AbstractTemplateResult<TData, TContext> {
  get [Symbol.toStringTag](): string {
    return `LazyTemplateResult(${nameOf(this._template)})`;
  }

  [directiveTag](
    part: Part,
    context: DirectiveContext<TContext>,
  ): BlockBinding<TemplateResult<TData, TContext>, TContext> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'LazyTemplateResult directive must be used in a child node, but it is used here in ' +
          nameOf(context.block?.binding.value ?? 'ROOT') +
          ':\n' +
          reportPart(part, reportUsedValue(this)),
      );
    }
    const binding = new TemplateResultBinding(this, part);
    return new BlockBinding(binding, context.block);
  }
}

export class TemplateResultBinding<TData, TContext>
  implements Binding<TemplateResult<TData, TContext>, TContext>, Effect
{
  private _value: TemplateResult<TData, TContext>;

  private readonly _part: ChildNodePart;

  private _pendingView: TemplateView<TData, TContext> | null = null;

  private _memoizedView: TemplateView<TData, TContext> | null = null;

  private _status = CommitStatus.Committed;

  constructor(value: TemplateResult<TData, TContext>, part: ChildNodePart) {
    this._value = value;
    this._part = part;
  }

  get value(): TemplateResult<TData, TContext> {
    return this._value;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._memoizedView?.startNode ?? this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  connect(context: UpdateContext<TContext>): void {
    const { template, data } = this._value;

    if (this._pendingView !== null) {
      if (this._pendingView !== this._memoizedView) {
        this._requestCommit(context);
        this._status = CommitStatus.Mounting;
      } else {
        this._status = CommitStatus.Committed;
      }
      this._pendingView.bind(data, context);
    } else {
      this._requestCommit(context);
      this._pendingView = template.render(data, context);
      this._pendingView.connect(context);
      this._status = CommitStatus.Mounting;
    }
  }

  bind(
    newValue: TemplateResult<TData, TContext>,
    context: UpdateContext<TContext>,
  ): void {
    DEBUG: {
      ensureDirective(AbstractTemplateResult, newValue, this._part);
    }

    const { template, data } = newValue;

    if (this._pendingView !== null) {
      if (this._value.template.isSameTemplate(template)) {
        // Here we use the same template as before. However the view may have
        // been unmounted. If so, we have to remount it.
        if (this._pendingView !== this._memoizedView) {
          this._requestCommit(context);
          this._status = CommitStatus.Mounting;
        } else {
          this._status = CommitStatus.Committed;
        }

        this._pendingView.bind(data, context);
      } else {
        // Here the template has been changed, so first, we unbind data from
        // the current view.
        this._pendingView.unbind(context);

        // Next, unmount the old view and mount the new view.
        this._requestCommit(context);
        this._status = CommitStatus.Mounting;

        // Finally, render the new template.
        this._pendingView = template.render(data, context);
        this._pendingView.connect(context);
      }
    } else {
      // The template has never been rendered here. We have to mount the new
      // view before rendering the template. This branch will never be executed
      // unless bind() is called before connect().
      this._requestCommit(context);
      this._status = CommitStatus.Mounting;

      this._pendingView = template.render(data, context);
      this._pendingView.connect(context);
    }

    this._value = newValue;
  }

  unbind(context: UpdateContext<TContext>): void {
    // Detach data from the current view before its unmount.
    this._pendingView?.unbind(context);
    if (this._memoizedView !== null) {
      this._requestCommit(context);
      this._status = CommitStatus.Unmounting;
    } else {
      this._status = CommitStatus.Committed;
    }
  }

  disconnect(context: UpdateContext<TContext>): void {
    this._pendingView?.disconnect(context);
    this._status = CommitStatus.Committed;
  }

  commit(): void {
    switch (this._status) {
      case CommitStatus.Mounting:
        this._memoizedView?.unmount(this._part);
        this._pendingView?.mount(this._part);
        this._memoizedView = this._pendingView;
        break;
      case CommitStatus.Unmounting:
        this._memoizedView?.unmount(this._part);
        this._memoizedView = null;
        break;
    }

    this._status = CommitStatus.Committed;
  }

  private _requestCommit(context: UpdateContext<TContext>): void {
    if (this._status === CommitStatus.Committed) {
      context.enqueueMutationEffect(this);
    }
  }
}
