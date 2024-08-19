import type { RenderContext, TemplateDirective } from '@emonkak/ebit';
import { component, ifElse, keyedList } from '@emonkak/ebit/directives.js';

import { StoryState, type StoryType } from '../state.js';
import { StoryView } from './StoryView.js';

export interface StoriesPageProps {
  type: StoryType;
  page?: number;
}

const STORIES_PER_PAGE = 28;

export function StoriesPage(
  { type, page = 1 }: StoriesPageProps,
  context: RenderContext,
): TemplateDirective {
  const state = context.use(StoryState);
  const stories = context.use(state.stories$);
  const isLoading = context.use(state.isLoading$);

  context.useEffect(() => {
    if (state.type$.value !== type || state.page$.value !== page) {
      state.fetchStories(type, page);
    }
  }, [type, page]);

  return context.html`
    <div class="story-view">
      <div class="story-list-nav">
        <${ifElse(
          !isLoading && page > 1,
          () => context.html`
            <a
              class="page-link"
              href=${`/${storyTypeToPathName(type)}/${page - 1}`}
              aria-label="Previous Page"
            >
              &lt; prev
            </a>
          `,
          () => context.html`
            <span class="page-link disabled" aria-hidden="true">
              &lt; prev
            </span>
          `,
        )}>
        <span>page ${page}</span>
        <${ifElse(
          !isLoading && stories.length >= STORIES_PER_PAGE,
          () => context.html`
            <a
              class="page-link"
              href=${`/${storyTypeToPathName(type)}/${page + 1}`}
              aria-label="Next Page"
            >
              more &gt;
            </a>
          `,
          () => context.html`
            <span class="page-link disabled" aria-hidden="true">
              more &gt;
            </span>
          `,
        )}>
      </div>
      <main class="story-list">
        <ul>
          <${keyedList(
            stories,
            (story) => story.id,
            (story) => component(StoryView, { story }),
          )}>
        </ul>
      </main>
    </div>
  `;
}

function storyTypeToPathName(type: StoryType): string {
  switch (type) {
    case 'news':
      return 'top';
    case 'newest':
      return 'new';
    case 'show':
      return 'show';
    case 'ask':
      return 'ask';
    case 'jobs':
      return 'jobs';
  }
}
