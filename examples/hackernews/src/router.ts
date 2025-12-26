import { integer, Router, route, wildcard } from 'barebind/addons/router';

import { ItemPage } from './item/ItemPage.js';
import { StoriesPage } from './story/StoriesPage.js';
import { UserPage } from './user/UserPage.js';

export const router = new Router<any, any>([
  route([''], () => StoriesPage({ type: 'news' })),
  route(['top'], null, [
    route([integer], ([page]) => StoriesPage({ type: 'news', page })),
  ]),
  route(['new'], () => StoriesPage({ type: 'newest' }), [
    route([integer], ([page]) => StoriesPage({ type: 'news', page })),
  ]),
  route(['show'], () => StoriesPage({ type: 'show' }), [
    route([integer], ([page]) => StoriesPage({ type: 'show', page })),
  ]),
  route(['ask'], () => StoriesPage({ type: 'ask' }), [
    route([integer], ([page]) => StoriesPage({ type: 'ask', page })),
  ]),
  route(['jobs'], () => StoriesPage({ type: 'jobs' }), [
    route([integer], ([page]) => StoriesPage({ type: 'jobs', page })),
  ]),
  route(['items', integer], ([id]) => ItemPage({ id })),
  route(['users', wildcard], ([id]) => UserPage({ id })),
]);
