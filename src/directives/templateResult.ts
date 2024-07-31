import { BlockBinding } from '../block.js';
import { ensureDirective, reportPart } from '../error.js';
import {
  type Binding,
  type ChildNodePart,
  type Effect,
  type Part,
  PartType,
  type Template,
  type TemplateDirective,
  type TemplateFragment,
  type UpdateContext,
  type Updater,
  directiveTag,
  nameOf,
  nameTag,
} from '../types.js';

enum Status {
  Fresh,
  Mounting,
  Unmounting,
}

abstract class AbstractTemplateResult<TData, TContext>
  implements TemplateDirective<TData, TContext>
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

  abstract [directiveTag](
    part: Part,
    _context: UpdateContext<TContext>,
  ): Binding<TemplateDirective<TData, TContext>, TContext>;

  valueOf(): this {
    return this;
  }
}

export class TemplateResult<TData, TContext> extends AbstractTemplateResult<
  TData,
  TContext
> {
  get [nameTag](): string {
    return 'TemplateResult(' + nameOf(this._template) + ')';
  }

  [directiveTag](
    part: Part,
    _context: UpdateContext<TContext>,
  ): TemplateResultBinding<TData, TContext> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'TemplateResult directive must be used in a child node, but it is used here:\n' +
          reportPart(part),
      );
    }
    return new TemplateResultBinding(this, part);
  }
}

export class LazyTemplateResult<TData, TContext> extends AbstractTemplateResult<
  TData,
  TContext
> {
  get [nameTag](): string {
    return 'LazyTemplateResult(' + nameOf(this._template) + ')';
  }

  [directiveTag](
    part: Part,
    context: UpdateContext<TContext>,
  ): BlockBinding<TemplateDirective<TData, TContext>, TContext> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'LazyTemplateResult directive must be used in a child node, but it is used here:\n' +
          reportPart(part),
      );
    }
    // Make the directive a target for incremental updates.
    return new BlockBinding(
      new TemplateResultBinding(this, part),
      context.currentBlock,
    );
  }
}

export class TemplateResultBinding<TData, TContext>
  implements Binding<AbstractTemplateResult<TData, TContext>, TContext>, Effect
{
  private _directive: AbstractTemplateResult<TData, TContext>;

  private readonly _part: ChildNodePart;

  private _pendingFragment: TemplateFragment<TData, TContext> | null = null;

  private _memoizedFragment: TemplateFragment<TData, TContext> | null = null;

  private _status = Status.Fresh;

  constructor(
    directive: AbstractTemplateResult<TData, TContext>,
    part: ChildNodePart,
  ) {
    this._directive = directive;
    this._part = part;
  }

  get value(): AbstractTemplateResult<TData, TContext> {
    return this._directive;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._memoizedFragment?.startNode ?? this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  connect(context: UpdateContext<TContext>): void {
    const { template, data } = this._directive;

    if (this._pendingFragment === null) {
      this._requestMutation(context.updater, Status.Mounting);
      this._pendingFragment = template.render(data, context);
    }

    this._pendingFragment.connect(context);
  }

  bind(
    newValue: AbstractTemplateResult<TData, TContext>,
    context: UpdateContext<TContext>,
  ): void {
    DEBUG: {
      ensureDirective(AbstractTemplateResult, newValue, this._part);
    }

    const { template, data } = newValue;

    if (this._pendingFragment !== null) {
      if (this._directive.template.isSameTemplate(template)) {
        // Here we use the same template as before. However the fragment may have
        // been unmounted. If so, we have to remount it.
        if (this._pendingFragment !== this._memoizedFragment) {
          this._requestMutation(context.updater, Status.Mounting);
        }

        this._pendingFragment.bind(data, context);
      } else {
        // Here the template has been changed, so first, we unbind data from the current
        // fragment.
        this._pendingFragment.unbind(context);

        // Next, unmount the old fragment and mount the new fragment.
        this._requestMutation(context.updater, Status.Mounting);

        // Finally, render the new template.
        this._pendingFragment = template.render(data, context);
        this._pendingFragment.connect(context);
      }
    } else {
      // The template has never been rendered here. We have to mount the new
      // fragment before rendering the template. This branch will never be
      // executed unless bind() is called before connect().
      this._requestMutation(context.updater, Status.Mounting);

      this._pendingFragment = template.render(data, context);
      this._pendingFragment.connect(context);
    }

    this._directive = newValue;
  }

  unbind(context: UpdateContext<TContext>): void {
    // Detach data from the current fragment before its unmount.
    this._pendingFragment?.unbind(context);

    this._requestMutation(context.updater, Status.Unmounting);
  }

  disconnect(): void {
    this._pendingFragment?.disconnect();
  }

  commit(): void {
    switch (this._status) {
      case Status.Mounting:
        this._memoizedFragment?.unmount(this._part);
        this._pendingFragment?.mount(this._part);
        this._memoizedFragment = this._pendingFragment;
        break;
      case Status.Unmounting:
        this._memoizedFragment?.unmount(this._part);
        this._memoizedFragment = null;
        break;
    }

    this._status = Status.Fresh;
  }

  private _requestMutation(updater: Updater<TContext>, status: Status): void {
    if (this._status === Status.Fresh) {
      updater.enqueueMutationEffect(this);
    }
    this._status = status;
  }
}
