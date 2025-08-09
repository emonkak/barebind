import { component, type RenderContext, repeat } from 'barebind';

import { AppStore, type StoryType } from '../store.js';
import { StoryView } from './StoryView.js';

export interface StoriesPageProps {
  type: StoryType;
  page?: number;
}

const STORIES_PER_PAGE = 30;

export function StoriesPage(
  { type, page = 1 }: StoriesPageProps,
  $: RenderContext,
): unknown {
  const appStore = $.use(AppStore);
  const storyState = $.use(appStore.storyState$);

  $.useEffect(() => {
    if (storyState.type !== type || storyState.page !== page) {
      appStore.fetchStories(type, page);
    }
  }, [type, page]);

  return $.html`
    <div class="story-view">
      <div class="story-list-nav">
        <${
          !storyState.isLoading && page > 1
            ? $.html`
                <a
                  class="page-link"
                  href=${`#/${storyTypeToPathName(type)}/${page - 1}`}
                  aria-label="Previous Page"
                >
                  &lt; prev
                </a>
              `
            : $.html`
                <span class="page-link disabled" aria-hidden="true">
                  &lt; prev
                </span>
              `
        }>
        <span>page ${page}</span>
        <${
          !storyState.isLoading && storyState.stories.length >= STORIES_PER_PAGE
            ? $.html`
                <a
                  class="page-link"
                  href=${`#/${storyTypeToPathName(type)}/${page + 1}`}
                  aria-label="Next Page"
                >
                  more &gt;
                </a>
              `
            : $.html`
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
