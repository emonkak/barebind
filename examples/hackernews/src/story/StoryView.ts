import type { RenderContext } from '@emonkak/ebit';

import type { Story } from '../store.js';

export interface StoryViewProps {
  story: Story;
}

export function StoryView(
  { story }: StoryViewProps,
  $: RenderContext,
): unknown {
  return $.html`
    <li class="story-item">
      <div class="score">${story.points}</div>
      <div class="title">
        <${
          story.url.startsWith('item?id=')
            ? $.html`<a href=${`#/items/${story.id}`}>${story.title}</a>`
            : $.html`
              <a href=${story.url} target="_blank" rel="noreferrer">
                ${story.title}
              </a>
              <span class="host"> (${story.domain})</span>
            `
        }>
      </div>
      <div class="meta">
        <${
          story.type === 'job'
            ? $.html`<a href=${`#/items/${story.id}`}>${story.time_ago}</a>`
            : $.html`
              by <a href=${`#/users/${story.user}`}>${story.user}</a>${' '}
              ${story.time_ago}${' | '}
              <a href=${`#/items/${story.id}`}>
                ${story.comments_count ? `${story.comments_count} comments` : 'discuss'}
              </a>
            `
        }>
        <${
          story.type !== 'link'
            ? $.html` | <span class="label">${story.type}</span>`
            : null
        }>
      </div>
    </li>
  `;
}
