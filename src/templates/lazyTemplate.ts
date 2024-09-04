import type { DirectiveContext, Template, TemplateView } from '../baseTypes.js';

export class LazyTemplate<TData, TContext>
  implements Template<TData, TContext>
{
  private readonly _templateFactory: () => Template<TData, TContext>;

  private _memoizedTemplate: Template<TData, TContext> | null = null;

  constructor(templateFactory: () => Template<TData, TContext>) {
    this._templateFactory = templateFactory;
  }

  get templateFactory(): () => Template<TData, TContext> {
    return this._templateFactory;
  }

  render(
    data: TData,
    context: DirectiveContext<TContext>,
  ): TemplateView<TData, TContext> {
    if (this._memoizedTemplate === null) {
      const templateFactory = this._templateFactory;
      this._memoizedTemplate = templateFactory();
    }
    return this._memoizedTemplate.render(data, context);
  }

  isSameTemplate(other: Template<unknown>): boolean {
    return other === this;
  }
}
