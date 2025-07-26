import { component, type RenderContext } from '@emonkak/ebit';

import { AppStore } from '../store.js';
import { ItemView } from './ItemView.js';

export interface ItemPageProps {
  id: number;
}

export function ItemPage(
  { id }: ItemPageProps,
  context: RenderContext,
): unknown {
  const appStore = context.use(AppStore);
  const itemState = context.use(appStore.itemState$);

  context.useEffect(() => {
    if (itemState.item?.id !== id) {
      appStore.fetchItem(id);
    }
  }, [id]);

  if (!itemState.isLoading && itemState.error !== null) {
    return context.html`
      <div class="error-view">
        <h1>${itemState.error.error}</h1>
      </div>
    `;
  }

  return !itemState.isLoading && itemState.item?.id === id
    ? component(ItemView, { item: itemState.item })
    : null;
}
