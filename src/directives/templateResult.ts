import {
  type Binding,
  BindingStatus,
  type ChildNodePart,
  type DirectiveContext,
  type Effect,
  type Part,
  PartType,
  type Template,
  type TemplateDirective,
  type TemplateFragment,
  type UpdateContext,
  directiveTag,
  nameOf,
  nameTag,
} from '../baseTypes.js';
import { ensureDirective, reportPart } from '../error.js';
import { Root as RootBinding } from '../root.js';

export abstract class AbstractTemplateResult<TData, TContext>
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
    _context: DirectiveContext,
  ): Binding<AbstractTemplateResult<TData, TContext>, TContext>;
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
    _context: DirectiveContext,
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
    context: DirectiveContext<TContext>,
  ): RootBinding<AbstractTemplateResult<TData, TContext>, TContext> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'LazyTemplateResult directive must be used in a child node, but it is used here:\n' +
          reportPart(part),
      );
    }
    return new RootBinding<AbstractTemplateResult<TData, TContext>, TContext>(
      new TemplateResultBinding(this, part),
      context,
    );
  }
}

export class TemplateResultBinding<TData, TContext>
  implements Binding<AbstractTemplateResult<TData, TContext>, TContext>, Effect
{
  private _value: AbstractTemplateResult<TData, TContext>;

  private readonly _part: ChildNodePart;

  private _pendingFragment: TemplateFragment<TData, TContext> | null = null;

  private _memoizedFragment: TemplateFragment<TData, TContext> | null = null;

  private _status = BindingStatus.Committed;

  constructor(
    value: AbstractTemplateResult<TData, TContext>,
    part: ChildNodePart,
  ) {
    this._value = value;
    this._part = part;
  }

  get value(): AbstractTemplateResult<TData, TContext> {
    return this._value;
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
    const { template, data } = this._value;

    if (this._pendingFragment !== null) {
      if (this._pendingFragment !== this._memoizedFragment) {
        this._requestMutation(context, BindingStatus.Mounting);
      }
      this._pendingFragment.bind(data, context);
    } else {
      this._requestMutation(context, BindingStatus.Mounting);
      this._pendingFragment = template.render(data, context);
      this._pendingFragment.connect(context);
    }
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
      if (this._value.template.isSameTemplate(template)) {
        // Here we use the same template as before. However the fragment may have
        // been unmounted. If so, we have to remount it.
        if (this._pendingFragment !== this._memoizedFragment) {
          this._requestMutation(context, BindingStatus.Mounting);
        }

        this._pendingFragment.bind(data, context);
      } else {
        // Here the template has been changed, so first, we unbind data from the current
        // fragment.
        this._pendingFragment.unbind(context);

        // Next, unmount the old fragment and mount the new fragment.
        this._requestMutation(context, BindingStatus.Mounting);

        // Finally, render the new template.
        this._pendingFragment = template.render(data, context);
        this._pendingFragment.connect(context);
      }
    } else {
      // The template has never been rendered here. We have to mount the new
      // fragment before rendering the template. This branch will never be
      // executed unless bind() is called before connect().
      this._requestMutation(context, BindingStatus.Mounting);

      this._pendingFragment = template.render(data, context);
      this._pendingFragment.connect(context);
    }

    this._value = newValue;
  }

  unbind(context: UpdateContext<TContext>): void {
    // Detach data from the current fragment before its unmount.
    this._pendingFragment?.unbind(context);

    this._requestMutation(context, BindingStatus.Unmounting);
  }

  disconnect(): void {
    this._pendingFragment?.disconnect();
  }

  commit(): void {
    switch (this._status) {
      case BindingStatus.Mounting:
        this._memoizedFragment?.unmount(this._part);
        this._pendingFragment?.mount(this._part);
        this._memoizedFragment = this._pendingFragment;
        break;
      case BindingStatus.Unmounting:
        this._memoizedFragment?.unmount(this._part);
        this._memoizedFragment = null;
        break;
    }

    this._status = BindingStatus.Committed;
  }

  private _requestMutation(
    context: UpdateContext<TContext>,
    newStatus: BindingStatus,
  ): void {
    if (this._status === BindingStatus.Committed) {
      context.enqueueMutationEffect(this);
    }
    this._status = newStatus;
  }
}
