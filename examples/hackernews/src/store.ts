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

export class ItemState {
  item: Item | null = null;
  isLoading: boolean = false;
  error: APIError | null = null;
}

export class StoryState {
  stories: Story[] = [];
  type: StoryType | null = null;
  page: number = 0;
  isLoading: boolean = false;
}

export class UserState {
  user: User | null = null;
  isLoading: boolean = false;
  error: APIError | null = null;
}

export class AppStore {
  readonly itemState$: Derivable<ItemState> = Derivable.from<ItemState>(
    new ItemState(),
  );
  readonly storyState$: Derivable<StoryState> = Derivable.from<StoryState>(
    new StoryState(),
  );
  readonly userState$: Derivable<UserState> = Derivable.from<UserState>(
    new UserState(),
  );

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
