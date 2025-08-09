import { component, type RenderContext } from 'barebind';

import { AppStore } from '../store.js';
import { UserView } from './UserView.js';

export interface UserPageProps {
  id: string;
}

export function UserPage({ id }: UserPageProps, $: RenderContext): unknown {
  const appStore = $.use(AppStore);
  const userState = $.use(appStore.userState$);

  $.useEffect(() => {
    if (userState.user?.id !== id) {
      appStore.fetchUser(id);
    }
  }, [id]);

  if (!userState.isLoading && userState.error !== null) {
    return $.html`
      <div class="error-view">
        <h1>${userState.error.error}</h1>
      </div>
    `;
  }

  return !userState.isLoading && userState.user?.id === id
    ? component(UserView, { user: userState.user })
    : null;
}
