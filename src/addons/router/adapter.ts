export interface BrowserAdapterOptions {
  location?: Location;
  navigation?: Navigation;
}

export interface HashAdapterOptions {
  location?: Location;
  navigation?: Navigation;
}

export interface NavigationAdapter {
  getCurrentURL(): string;
  getCurrentState(): unknown;
  installHandler(handler: NavigationSceneHandler): () => void;
  navigate(url: string, options?: NavigationNavigateOptions): Promise<void>;
}

export interface NavigationScene {
  url: string;
  state: unknown;
  navigationType: NavigationType | null;
}

export type NavigationSceneHandler = (
  scene: NavigationScene,
) => Promise<void> | void;

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

  getCurrentURL(): string {
    return toRelativeUrl(this._location);
  }

  getCurrentState(): unknown {
    return this._navigation.currentEntry?.getState();
  }

  installHandler(handler: NavigationSceneHandler): () => void {
    const handleNavigate = (event: NavigateEvent) => {
      if (
        event.canIntercept &&
        event.destination.sameDocument &&
        event.downloadRequest === null &&
        !event.hashChange
      ) {
        event.intercept({
          async handler() {
            await handler({
              url: toRelativeUrl(new URL(event.destination.url)),
              state: event.destination.getState(),
              navigationType: event.navigationType,
            });
            event.scroll();
          },
        });
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

  getCurrentURL(): string {
    return stripLeadingHashmark(this._location.hash);
  }

  getCurrentState(): unknown {
    return this._navigation.currentEntry?.getState();
  }

  installHandler(handler: NavigationSceneHandler): () => void {
    const handleNavigate = (event: NavigateEvent) => {
      if (
        event.canIntercept &&
        event.destination.sameDocument &&
        event.hashChange
      ) {
        event.intercept({
          async handler() {
            await handler({
              url: stripLeadingHashmark(new URL(event.destination.url).hash),
              state: event.destination.getState(),
              navigationType: event.navigationType,
            });
            event.scroll();
          },
        });
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
  private readonly _handlers: Set<NavigationSceneHandler> = new Set();

  constructor(url: string, state: unknown) {
    this._url = url;
    this._state = state;
  }

  getCurrentURL(): string {
    return this._url;
  }

  getCurrentState(): unknown {
    return this._state;
  }

  installHandler(handler: NavigationSceneHandler): () => void {
    this._handlers.add(handler);
    return () => {
      this._handlers.delete(handler);
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

    for (const handler of this._handlers) {
      handler(scene, interceptor);
    }

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
