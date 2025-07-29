import { component, type RenderContext, repeat } from '@emonkak/ebit';

import { AppStore, type StoryType } from '../store.js';
import { StoryView } from './StoryView.js';

export interface StoriesPageProps {
  type: StoryType;
  page?: number;
}

const STORIES_PER_PAGE = 30;

export function StoriesPage(
  { type, page = 1 }: StoriesPageProps,
  context: RenderContext,
): unknown {
  const appStore = context.use(AppStore);
  const storyState = context.use(appStore.storyState$);

  context.useEffect(() => {
    if (storyState.type !== type || storyState.page !== page) {
      appStore.fetchStories(type, page);
    }
  }, [type, page]);

  return context.html`
    <div class="story-view">
      <div class="story-list-nav">
        <${
          !storyState.isLoading && page > 1
            ? context.html`
                <a
                  class="page-link"
                  href=${`#/${storyTypeToPathName(type)}/${page - 1}`}
                  aria-label="Previous Page"
                >
                  &lt; prev
                </a>
              `
            : context.html`
                <span class="page-link disabled" aria-hidden="true">
                  &lt; prev
                </span>
              `
        }>
        <span>page ${page}</span>
        <${
          !storyState.isLoading && storyState.stories.length >= STORIES_PER_PAGE
            ? context.html`
                <a
                  class="page-link"
                  href=${`#/${storyTypeToPathName(type)}/${page + 1}`}
                  aria-label="Next Page"
                >
                  more &gt;
                </a>
              `
            : context.html`
                <span class="page-link disabled" aria-hidden="true">
                  more &gt;
                </span>
              `
        }>
      </div>
      <div class="story-list">
        <ul>
          <${repeat({
            source: storyState.stories,
            keySelector: (story) => story.id,
            valueSelector: (story) => component(StoryView, { story }),
          })}>
        </ul>
      </div>
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
