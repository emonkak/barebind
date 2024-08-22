import type { DirectiveContext, Template, TemplateView } from '../baseTypes.js';

export class LazyTemplate<TKey, TData, TContext>
  implements Template<TData, TContext>
{
  readonly _templateFactory: () => Template<TData, TContext>;

  readonly _key: TKey;

  constructor(templateFactory: () => Template<TData, TContext>, key: TKey) {
    this._templateFactory = templateFactory;
    this._key = key;
  }

  get templateFactory(): () => Template<TData, TContext> {
    return this._templateFactory;
  }

  get key(): TKey {
    return this._key;
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
