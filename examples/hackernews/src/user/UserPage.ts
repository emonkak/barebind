import type { RenderContext, TemplateDirective } from '@emonkak/ebit';
import { component, when } from '@emonkak/ebit/directives.js';

import { UserState } from '../state.js';
import { UserView } from './UserView.js';

export interface UserPageProps {
  id: string;
}

export function UserPage(
  { id }: UserPageProps,
  context: RenderContext,
): TemplateDirective {
  const state = context.use(UserState);
  const user = context.use(state.user$);
  const error = context.use(state.error$);
  const isLoading = context.use(state.isLoading$);

  context.useEffect(() => {
    if (state.user$.value === null || state.user$.value.id !== id) {
      state.fetchUser(id);
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
    when(!isLoading && user !== null, () =>
      component(UserView, { user: user! }),
    ),
  );
}
