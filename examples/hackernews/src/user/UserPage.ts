import { component, type RenderContext } from '@emonkak/ebit';

import { AppStore } from '../store.js';
import { UserView } from './UserView.js';

export interface UserPageProps {
  id: string;
}

export function UserPage(
  { id }: UserPageProps,
  context: RenderContext,
): unknown {
  const appStore = context.use(AppStore);
  const userState = context.use(appStore.userState$);

  context.useEffect(() => {
    if (userState.user?.id !== id) {
      appStore.fetchUser(id);
    }
  }, [id]);

  if (!userState.isLoading && userState.error !== null) {
    return context.html`
      <div class="error-view">
        <h1>${userState.error.error}</h1>
      </div>
    `;
  }

  return !userState.isLoading && userState.user?.id === id
    ? component(UserView, { user: userState.user })
    : null;
}
