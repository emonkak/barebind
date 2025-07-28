import {
  $customHook,
  type CustomHookObject,
  type HookContext,
} from '@emonkak/ebit';
import { Observable } from '@emonkak/ebit/extensions/observable';

const STORY_API_ORIGIN = 'https://node-hnapi.herokuapp.com';
const USER_API_ORIGIN = 'https://hacker-news.firebaseio.com';

export interface APIError {
  error: string;
}

export interface Comment {
  comments: Comment[];
  content: string;
  id: number;
  level: number;
  time: number;
  time_ago: string;
  user: string;
}

export interface Item {
  comments: Comment[];
  comments_count: number;
  content: string;
  id: number;
  points: number;
  time: number;
  time_ago: string;
  title: string;
  type: string;
  url: string;
  domain?: string;
  user: string;
}

export interface Story {
  comments_count: number;
  domain: string;
  id: number;
  points: number;
  time: number;
  time_ago: string;
  title: string;
  type: string;
  url: string;
  user: string;
}

export type StoryType = 'news' | 'newest' | 'show' | 'ask' | 'jobs';

export interface User {
  about?: string;
  created: number;
  id: string;
  karma: number;
  submitted: number[];
}

export interface ItemState {
  item: Item | null;
  isLoading: boolean;
  error: APIError | null;
}

export interface StoryState {
  stories: Story[];
  type: StoryType | null;
  page: number;
  isLoading: boolean;
}

export interface UserState {
  user: User | null;
  isLoading: boolean;
  error: APIError | null;
}

export class AppStore implements CustomHookObject<void> {
  static [$customHook](context: HookContext): AppStore {
    const state = context.getContextValue(this);
    if (!(state instanceof this)) {
      throw new Error(`${this.name} is not registered in the context.`);
    }
    return state;
  }

  readonly itemState$: Observable<ItemState> = Observable.from({
    item: null,
    isLoading: false,
    error: null,
  });

  readonly storyState$: Observable<StoryState> = Observable.from({
    stories: [],
    type: null,
    page: 0,
    isLoading: false,
  });

  readonly userState$: Observable<UserState> = Observable.from({
    user: null,
    isLoading: false,
    error: null,
  });

  [$customHook](context: HookContext): void {
    context.setContextValue(this.constructor, this);
  }

  async fetchItem(id: number): Promise<void> {
    return this.itemState$.mutate(async (itemState) => {
      itemState.isLoading = true;

      try {
        const url = STORY_API_ORIGIN + '/item/' + id;
        const response = await fetch(url);
        const data = response.ok
          ? await response.json()
          : { error: response.statusText };

        if (typeof data?.error === 'string') {
          itemState.item = null;
          itemState.error = data;
        } else {
          itemState.item = data;
          itemState.error = null;
        }
      } finally {
        itemState.isLoading = false;
      }
    });
  }

  async fetchUser(id: string): Promise<void> {
    return this.userState$.mutate(async (userState) => {
      userState.isLoading = true;

      try {
        const url = USER_API_ORIGIN + '/v0/user/' + id + '.json';
        const response = await fetch(url);
        const data = response.ok ? await response.json() : null;

        if (data === null) {
          userState.user = null;
          userState.error = { error: `User ${id} not found.` };
        } else {
          userState.user = data;
          userState.error = null;
        }
      } finally {
        userState.isLoading = false;
      }
    });
  }

  async fetchStories(type: StoryType, page: number): Promise<void> {
    return this.storyState$.mutate(async (storyState) => {
      storyState.isLoading = true;

      try {
        const url =
          STORY_API_ORIGIN +
          '/' +
          type +
          '?' +
          new URLSearchParams({ page: page.toString() });
        const response = await fetch(url);
        if (response.ok) {
          storyState.stories = await response.json();
          storyState.type = type;
          storyState.page = page;
        }
      } finally {
        storyState.isLoading = false;
      }
    });
  }
}
