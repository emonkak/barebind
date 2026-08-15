export interface BrowserAdapterOptions {
  location?: Location;
  navigation?: Navigation;
}

export interface HashAdapterOptions {
  location?: Location;
  navigation?: Navigation;
}

export interface NavigationAdapter {
  getCurrentState(): unknown;
  getCurrentURL(): string;
  listen(listener: NavigationSceneListener): () => void;
  navigate(url: string, options?: NavigationNavigateOptions): Promise<void>;
}

export type NavigationInterceptor = Pick<NavigateEvent, 'intercept' | 'scroll'>;

export interface NavigationScene {
  url: string;
  state: unknown;
  navigationType: NavigationType | null;
}

export type NavigationSceneListener = (
  scene: NavigationScene,
  interceptor: NavigationInterceptor,
) => void;

type URLLike = Pick<URL, 'pathname' | 'search' | 'hash'>;

export class BrowserAdapter implements NavigationAdapter {
  private readonly _location: Location;
  private readonly _navigation: Navigation;

  constructor({
    location = window.location,
    navigation = window.navigation,
  }: BrowserAdapterOptions = {}) {
    this._location = location;
    this._navigation = navigation;
  }

  getCurrentState(): unknown {
    return this._navigation.currentEntry?.getState();
  }

  getCurrentURL(): string {
    return toRelativeUrl(this._location);
  }

  listen(listener: NavigationSceneListener): () => void {
    const handleNavigate = (event: NavigateEvent) => {
      if (
        event.canIntercept &&
        event.destination.sameDocument &&
        event.downloadRequest === null &&
        !event.hashChange
      ) {
        const scene = {
          url: toRelativeUrl(new URL(event.destination.url)),
          state: event.destination.getState(),
          navigationType: event.navigationType,
        };
        listener(scene, event);
      }
    };
    this._navigation.addEventListener('navigate', handleNavigate);
    return () => {
      this._navigation.removeEventListener('navigate', handleNavigate);
    };
  }

  async navigate(
    url: string,
    options?: NavigationNavigateOptions,
  ): Promise<void> {
    await this._navigation.navigate(url, options).finished;
  }
}

export class HashAdapter implements NavigationAdapter {
  private readonly _location: Location;
  private readonly _navigation: Navigation;

  constructor({
    location = window.location,
    navigation = window.navigation,
  }: HashAdapterOptions = {}) {
    this._location = location;
    this._navigation = navigation;
  }

  getCurrentState(): unknown {
    return this._navigation.currentEntry?.getState();
  }

  getCurrentURL(): string {
    return stripLeadingHashmark(this._location.hash);
  }

  listen(listener: NavigationSceneListener): () => void {
    const handleNavigate = (event: NavigateEvent) => {
      if (
        event.canIntercept &&
        event.destination.sameDocument &&
        event.hashChange
      ) {
        const scene = {
          url: stripLeadingHashmark(new URL(event.destination.url).hash),
          state: event.destination.getState(),
          navigationType: event.navigationType,
        };
        listener(scene, event);
      }
    };
    this._navigation.addEventListener('navigate', handleNavigate);
    return () => {
      this._navigation.removeEventListener('navigate', handleNavigate);
    };
  }

  async navigate(
    url: string,
    options?: NavigationNavigateOptions,
  ): Promise<void> {
    await this._navigation.navigate('#' + url, options).finished;
  }
}

export class InMemoryAdapter implements NavigationAdapter {
  private _url: string;
  private _state: unknown;
  private readonly _listeners: Set<NavigationSceneListener> = new Set();

  constructor(url: string, state: unknown) {
    this._url = url;
    this._state = state;
  }

  getCurrentState(): unknown {
    return this._state;
  }

  getCurrentURL(): string {
    return this._url;
  }

  listen(listener: NavigationSceneListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  async navigate(
    url: string,
    options: NavigationNavigateOptions = {},
  ): Promise<void> {
    const { state, history } = options;
    const navigationType =
      history === 'push' || history === 'replace'
        ? history
        : url === this._url
          ? 'replace'
          : 'push';
    const scene = { url, state, navigationType };
    const interceptor: NavigationInterceptor = {
      async intercept({ handler } = {}) {
        const promise = handler?.();
        if (promise !== undefined) {
          promises.push(promise);
        }
      },
      scroll() {},
    };
    const promises: PromiseLike<void>[] = [];

    for (const listener of this._listeners) {
      listener(scene, interceptor);
    }

    await Promise.all(promises);

    this._url = url;
    this._state = state;
  }
}

function stripLeadingHashmark(s: string): string {
  return s.startsWith('#') ? s.slice(1) : s;
}

function toRelativeUrl(url: URLLike): string {
  return url.pathname + url.search + url.hash;
}
