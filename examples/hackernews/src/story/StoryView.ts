import type { RenderContext, TemplateDirective } from '@emonkak/ebit';
import { ifElse, when } from '@emonkak/ebit/directives.js';

import type { Story } from '../state.js';

export interface StoryProps {
  story: Story;
}

export function StoryView(
  { story }: StoryProps,
  context: RenderContext,
): TemplateDirective {
  return context.html`
    <li class="story-item">
      <div class="score">${story.points}</div>
      <div class="title">
        <${ifElse(
          story.url.startsWith('item?id='),
          () =>
            context.html`<a href=${`#/items/${story.id}`}>${story.title}</a>`,
          () => context.html`
            <a href=${story.url} target="_blank" rel="noreferrer">
              ${story.title}
            </a>
            <span class="host"> (${story.domain})</span>
          `,
        )}>
      </div>
      <div class="meta">
        <${ifElse(
          story.type === 'job',
          () =>
            context.html`<a href=${`#/items/${story.id}`}>${story.time_ago}</a>`,
          () => context.html`
            by <a href=${`#/users/${story.user}`}>${story.user}</a>${' '}
            ${story.time_ago}${' | '}
            <a href=${`#/items/${story.id}`}>
              ${story.comments_count ? `${story.comments_count} comments` : 'discuss'}
            </a>
          `,
        )}>
        <${when(
          story.type !== 'link',
          () => context.html`
            ${' | '}<span class="label">${story.type}</span>
          `,
        )}>
      </div>
    </li>
  `;
}
