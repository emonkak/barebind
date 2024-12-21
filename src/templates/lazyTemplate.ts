import type { DirectiveContext, Template, TemplateView } from '../baseTypes.js';
import { LazyTemplateResult } from '../directives/templateResult.js';

type State<TValues, TContext> =
  | { initialized: false; factory: () => Template<TValues, TContext> }
  | { initialized: true; template: Template<TValues, TContext> };

export class LazyTemplate<TValues, TContext>
  implements Template<TValues, TContext>
{
  private _state: State<TValues, TContext>;

  constructor(factory: () => Template<TValues, TContext>) {
    this._state = { initialized: false, factory };
  }

  get template(): Template<TValues, TContext> {
    if (!this._state.initialized) {
      const { factory } = this._state;
      this._state = { initialized: true, template: factory() };
    }
    return this._state.template;
  }

  render(
    values: TValues,
    context: DirectiveContext<TContext>,
  ): TemplateView<TValues, TContext> {
    return this.template.render(values, context);
  }

  isSameTemplate(other: Template<unknown>): boolean {
    return other === this;
  }

  wrapInResult(values: TValues): LazyTemplateResult<TValues, TContext> {
    return new LazyTemplateResult(this, values);
  }
}
