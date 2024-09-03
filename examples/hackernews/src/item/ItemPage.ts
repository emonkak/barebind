import {
  ChildTemplate,
  type RenderContext,
  type TemplateResult,
} from '@emonkak/ebit';
import {
  component,
  eagerTemplate,
  optional,
} from '@emonkak/ebit/directives.js';

import { ItemState } from '../state.js';
import { ItemView } from './ItemView.js';

export interface ItemPageProps {
  id: number;
}

export function ItemPage(
  { id }: ItemPageProps,
  context: RenderContext,
): TemplateResult {
  const state = context.use(ItemState);
  const [item, error, isLoading] = context.use([
    state.item$,
    state.error$,
    state.isLoading$,
  ]);
  const childTemplate = context.useMemo(() => new ChildTemplate(), []);

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

  return eagerTemplate(
    childTemplate,
    optional(
      !isLoading && item !== null ? component(ItemView, { item }) : null,
    ),
  );
}
