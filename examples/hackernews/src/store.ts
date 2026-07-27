import { Derivable } from 'barebind/addons/signal';

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

export class AppStore {
  readonly itemState$: Derivable<ItemState> = Derivable.from<ItemState>({
    item: null,
    isLoading: false,
    error: null,
  });

  readonly storyState$: Derivable<StoryState> = Derivable.from<StoryState>({
    stories: [],
    type: null,
    page: 0,
    isLoading: false,
  });

  readonly userState$: Derivable<UserState> = Derivable.from<UserState>({
    user: null,
    isLoading: false,
    error: null,
  });

  async fetchItem(id: number): Promise<void> {
    const isLoading$ = this.itemState$.get('isLoading');
    const item$ = this.itemState$.get('item');
    const error$ = this.itemState$.get('error');

    isLoading$.value = true;

    try {
      const url = STORY_API_ORIGIN + '/item/' + id;
      const response = await fetch(url);
      const data = response.ok
        ? await response.json()
        : { error: response.statusText };

      if (typeof data?.error === 'string') {
        item$.value = null;
        error$.value = data;
      } else {
        item$.value = data;
        error$.value = null;
      }
    } finally {
      isLoading$.value = false;
    }
  }

  async fetchUser(id: string): Promise<void> {
    const isLoading$ = this.userState$.get('isLoading');
    const user$ = this.userState$.get('user');
    const error$ = this.userState$.get('error');

    isLoading$.value = true;

    try {
      const url = USER_API_ORIGIN + '/v0/user/' + id + '.json';
      const response = await fetch(url);
      const data = response.ok ? await response.json() : null;

      if (data === null) {
        user$.value = null;
        error$.value = { error: `User ${id} not found.` };
      } else {
        user$.value = data;
        error$.value = null;
      }
    } finally {
      isLoading$.value = false;
    }
  }

  async fetchStories(type: StoryType, page: number): Promise<void> {
    const isLoading$ = this.storyState$.get('isLoading');
    const stories$ = this.storyState$.get('stories');
    const type$ = this.storyState$.get('type');
    const page$ = this.storyState$.get('page');

    isLoading$.value = true;

    try {
      const url =
        STORY_API_ORIGIN +
        '/' +
        type +
        '?' +
        new URLSearchParams({ page: page.toString() });
      const response = await fetch(url);
      if (response.ok) {
        stories$.value = await response.json();
        type$.value = type;
        page$.value = page;
      }
    } finally {
      isLoading$.value = false;
    }
  }
}
