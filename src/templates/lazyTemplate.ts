import type { DirectiveContext, Template, TemplateView } from '../baseTypes.js';
import { LazyTemplateResult } from '../directives/templateResult.js';

type State<TData, TContext> =
  | { initialized: false; factory: () => Template<TData, TContext> }
  | { initialized: true; template: Template<TData, TContext> };

export class LazyTemplate<TData, TContext>
  implements Template<TData, TContext>
{
  private _state: State<TData, TContext>;

  constructor(factory: () => Template<TData, TContext>) {
    this._state = { initialized: false, factory };
  }

  get template(): Template<TData, TContext> {
    if (!this._state.initialized) {
      const { factory } = this._state;
      this._state = { initialized: true, template: factory() };
    }
    return this._state.template;
  }

  render(
    data: TData,
    context: DirectiveContext<TContext>,
  ): TemplateView<TData, TContext> {
    return this.template.render(data, context);
  }

  isSameTemplate(other: Template<unknown>): boolean {
    return other === this;
  }

  wrapInResult(data: TData): LazyTemplateResult<TData, TContext> {
    return new LazyTemplateResult(this, data);
  }
}
