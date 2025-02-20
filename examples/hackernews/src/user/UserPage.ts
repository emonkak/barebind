import type { RenderContext, TemplateResult } from '@emonkak/ebit';
import { component, optional } from '@emonkak/ebit/directives.js';

import { UserStore } from '../store.js';
import { UserView } from './UserView.js';

export interface UserPageProps {
  id: string;
}

export function UserPage(
  { id }: UserPageProps,
  context: RenderContext,
): TemplateResult {
  const store = context.use(UserStore);
  const [user, error, isLoading] = context.use([
    store.user$,
    store.error$,
    store.isLoading$,
  ]);

  context.useEffect(() => {
    if (store.user$.value === null || store.user$.value.id !== id) {
      store.fetchUser(id);
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
    !isLoading && user !== null ? component(UserView, { user: user! }) : null,
  )}>`;
}
