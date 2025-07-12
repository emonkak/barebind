import type { RenderContext } from '@emonkak/ebit';
import { component } from '@emonkak/ebit/extensions';

import { ItemStore } from '../store.js';
import { ItemView } from './ItemView.js';

export interface ItemPageProps {
  id: number;
}

export function ItemPage(
  { id }: ItemPageProps,
  context: RenderContext,
): unknown {
  const store = context.use(ItemStore);
  const { item, isLoading, error } = store;

  context.use(store.asSignal());

  context.useEffect(() => {
    if (store.item === null || store.item.id !== id) {
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

  return !isLoading && item !== null ? component(ItemView, { item }) : null;
}
