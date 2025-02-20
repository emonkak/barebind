import type { RenderContext, TemplateResult } from '@emonkak/ebit';
import { component, keyedList, optional } from '@emonkak/ebit/directives.js';

import type { Item } from '../store.js';
import { CommentView } from './CommentView.js';

export interface ItemProps {
  item: Item;
}

export function ItemView(
  { item }: ItemProps,
  context: RenderContext,
): TemplateResult {
  return context.html`
    <div class="item-view">
      <div class="item-view-header">
        <a href=${item.url} target="_blank">
          <h1>${item.title}</h1>
        </a>
        <${optional(item.domain ? () => context.html`<span class="host">(${item.domain})</span>` : null)}>
        <div class="meta">
          ${item.points} points | by
          ${' '}<a href=${`#/users/${item.user}`}>${item.user}</a>
          ${' '}${item.time_ago} ago
        </div>
      </div>
      <div class="item-view-comments">
        <div class="item-view-comments-header">
          ${item.comments_count > 0 ? item.comments_count + ' comments' : 'No comments yet.'}
        </div>
        <ul class="comment-children">
          <${keyedList(
            item.comments,
            (comment) => comment.id,
            (comment) => component(CommentView, { comment }),
          )}>
        </ul>
      </div>
    </div>
  `;
}
