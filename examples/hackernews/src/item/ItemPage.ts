import { component, type RenderContext } from 'barebind';

import { AppStore } from '../store.js';
import { ItemView } from './ItemView.js';

export interface ItemPageProps {
  id: number;
}

export function ItemPage({ id }: ItemPageProps, $: RenderContext): unknown {
  const appStore = $.use(AppStore);
  const itemState = $.use(appStore.itemState$);

  $.useEffect(() => {
    if (itemState.item?.id !== id) {
      appStore.fetchItem(id);
    }
  }, [id]);

  if (!itemState.isLoading && itemState.error !== null) {
    return $.html`
      <div class="error-view">
        <h1>${itemState.error.error}</h1>
      </div>
    `;
  }

  return !itemState.isLoading && itemState.item?.id === id
    ? component(ItemView, { item: itemState.item })
    : null;
}
