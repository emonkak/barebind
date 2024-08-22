import type { RenderContext, TemplateDirective } from '@emonkak/ebit';
import { component, when } from '@emonkak/ebit/directives.js';

import { ItemState } from '../state.js';
import { ItemView } from './ItemView.js';

export interface ItemPageProps {
  id: number;
}

export function ItemPage(
  { id }: ItemPageProps,
  context: RenderContext,
): TemplateDirective {
  const state = context.use(ItemState);
  const item = context.use(state.item$);
  const error = context.use(state.error$);
  const isLoading = context.use(state.isLoading$);

  context.useEffect(() => {
    if (state.item$.value === null || state.item$.value.id !== id) {
      state.fetchItem(id);
    }
  }, [id]);

  if (!isLoading && error !== null) {
    return context.html`
      <div class="error-view">
        <h1>${error.error}</h1>
      </div>
    `;
  }

  return context.only(
    when(!isLoading && item !== null, () =>
      component(ItemView, { item: item! }),
    ),
  );
}
