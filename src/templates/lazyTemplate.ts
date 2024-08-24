import type { DirectiveContext, Template, TemplateView } from '../baseTypes.js';

export class LazyTemplate<TKey, TData, TContext>
  implements Template<TData, TContext>
{
  readonly _key: TKey;

  readonly _templateFactory: () => Template<TData, TContext>;

  constructor(key: TKey, templateFactory: () => Template<TData, TContext>) {
    this._key = key;
    this._templateFactory = templateFactory;
  }

  get key(): TKey {
    return this._key;
  }

  get templateFactory(): () => Template<TData, TContext> {
    return this._templateFactory;
  }

  render(
    data: TData,
    context: DirectiveContext<TContext>,
  ): TemplateView<TData, TContext> {
    const templateFactory = this._templateFactory;
    return templateFactory().render(data, context);
  }

  isSameTemplate(other: Template<TData>): boolean {
    return other instanceof LazyTemplate && this._key === other._key;
  }
}
