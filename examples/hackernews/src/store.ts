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

export class AppStore implements CustomHookObject<void> {
  static [$customHook](context: HookContext): AppStore {
    const state = context.getContextValue(this);
    if (!(state instanceof this)) {
      throw new Error(`${this.name} is not registered in the context.`);
    }
    return state;
  }

  readonly itemState$: Observable<ItemState>;

  readonly storyState$: Observable<StoryState>;

  readonly userState$: Observable<UserState>;

  constructor(
    itemState: ItemState,
    storyState: StoryState,
    userState: UserState,
  ) {
    this.itemState$ = Observable.from(itemState);
    this.storyState$ = Observable.from(storyState);
    this.userState$ = Observable.from(userState);
  }

  [$customHook](context: HookContext): void {
    context.setContextValue(this.constructor, this);
  }

  async fetchItem(id: number): Promise<void> {
    this.itemState$.set('isLoading', true);

    try {
      const url = STORY_API_ORIGIN + '/item/' + id;
      const response = await fetch(url);
      const data = response.ok
        ? await response.json()
        : { error: response.statusText };

      if (typeof data?.error === 'string') {
        this.itemState$.assign({ item: null, error: data });
      } else {
        this.itemState$.assign({ item: data, error: null });
      }
    } finally {
      this.itemState$.set('isLoading', false);
    }
  }

  async fetchUser(id: string): Promise<void> {
    this.userState$.set('isLoading', true);

    try {
      const url = USER_API_ORIGIN + '/v0/user/' + id + '.json';
      const response = await fetch(url);
      const data = response.ok ? await response.json() : null;

      if (data === null) {
        this.userState$.assign({
          user: null,
          error: { error: `User ${id} not found.` },
        });
      } else {
        this.userState$.assign({ user: data, error: null });
      }
    } finally {
      this.userState$.set('isLoading', false);
    }
  }

  async fetchStories(type: StoryType, page: number): Promise<void> {
    this.storyState$.set('isLoading', true);

    try {
      const url =
        STORY_API_ORIGIN +
        '/' +
        type +
        '?' +
        new URLSearchParams({ page: page.toString() });
      const response = await fetch(url);
      if (response.ok) {
        this.storyState$.assign({ stories: await response.json(), type, page });
      }
    } finally {
      this.storyState$.set('isLoading', false);
    }
  }
}

export class ItemState {
  item: Item | null = null;

  isLoading = false;

  error: APIError | null = null;
}

export class StoryState {
  stories: Story[] = [];

  type: StoryType | null = null;

  page = 0;

  isLoading = false;
}

export class UserState {
  user: User | null = null;

  isLoading: boolean = false;

  error: APIError | null = null;
}
