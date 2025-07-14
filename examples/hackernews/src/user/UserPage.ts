import type { RenderContext } from '@emonkak/ebit';
import { component } from '@emonkak/ebit/extensions';

import { UserStore } from '../store.js';
import { UserView } from './UserView.js';

export interface UserPageProps {
  id: string;
}

export function UserPage(
  { id }: UserPageProps,
  context: RenderContext,
): unknown {
  const store = context.use(UserStore);
  const { user, error, isLoading } = context.use(store.asSignal());

  context.useEffect(() => {
    if (store.user === null || store.user.id !== id) {
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

  return !isLoading && user !== null ? component(UserView, { user }) : null;
}
