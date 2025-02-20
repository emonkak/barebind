import type { RenderContext, TemplateResult } from '@emonkak/ebit';
import { component, optional } from '@emonkak/ebit/directives.js';

import { ItemState } from '../store.js';
import { ItemView } from './ItemView.js';

export interface ItemPageProps {
  id: number;
}

export function ItemPage(
  { id }: ItemPageProps,
  context: RenderContext,
): TemplateResult {
  const store = context.use(ItemState);
  const [item, error, isLoading] = context.use([
    store.item$,
    store.error$,
    store.isLoading$,
  ]);

  context.useEffect(() => {
    if (store.item$.value === null || store.item$.value.id !== id) {
      store.fetchItem(id);
    }
  }, [id]);

  if (!isLoading && error !== null) {
    return context.html`
      <div class="error-view">
        <h1>${error.error}</h1>
      </div>
    `;
  }

  return context.html`<${optional(
    !isLoading && item !== null ? component(ItemView, { item }) : null,
  )}>`;
}
