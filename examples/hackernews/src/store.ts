import { defineStore } from '@emonkak/ebit/extensions/store';

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

const STORY_API_ORIGIN = 'https://node-hnapi.herokuapp.com';
const USER_API_ORIGIN = 'https://hacker-news.firebaseio.com';

class StoryState {
  stories: Story[] = [];

  type: StoryType | null = null;

  page = 0;

  isLoading = false;

  async fetchStories(type: StoryType, page: number): Promise<void> {
    this.isLoading = true;

    try {
      const url =
        STORY_API_ORIGIN +
        '/' +
        type +
        '?' +
        new URLSearchParams({ page: page.toString() });
      const response = await fetch(url);
      if (response.ok) {
        this.stories = await response.json();
        this.type = type;
        this.page = page;
      }
    } finally {
      this.isLoading = false;
    }
  }
}

export const StoryStore = defineStore(StoryState);

export type StoryStore = InstanceType<typeof StoryStore>;

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

export interface Comment {
  comments: Comment[];
  content: string;
  id: number;
  level: number;
  time: number;
  time_ago: string;
  user: string;
}

class ItemState {
  item: Item | null = null;

  isLoading = false;

  error: APIError | null = null;

  async fetchItem(id: number): Promise<void> {
    this.isLoading = true;

    try {
      const url = STORY_API_ORIGIN + '/item/' + id;
      const response = await fetch(url);
      const data = response.ok
        ? await response.json()
        : { error: response.statusText };
      if (typeof data?.error === 'string') {
        this.item = null;
        this.error = data;
      } else {
        this.item = data;
        this.error = null;
      }
    } finally {
      this.isLoading = false;
    }
  }
}

export const ItemStore = defineStore(ItemState);

export type ItemStore = InstanceType<typeof ItemStore>;

export interface User {
  about?: string;
  created: number;
  id: string;
  karma: number;
  submitted: number[];
}

class UserState {
  user: User | null = null;

  isLoading: boolean = false;

  error: APIError | null = null;

  async fetchUser(id: string): Promise<void> {
    this.isLoading = true;

    try {
      const url = USER_API_ORIGIN + '/v0/user/' + id + '.json';
      const response = await fetch(url);
      const data = response.ok ? await response.json() : null;
      if (data === null) {
        this.user = null;
        this.error = { error: `User ${id} not found.` };
      } else {
        this.user = data;
        this.error = null;
      }
    } finally {
      this.isLoading = false;
    }
  }
}

export const UserStore = defineStore(UserState);

export type UserStore = InstanceType<typeof UserStore>;

export interface APIError {
  error: string;
}
