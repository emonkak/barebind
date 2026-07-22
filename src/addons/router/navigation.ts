import type { UpdateOptions } from '../../base.js';
import type { HookFunction } from '../../component.js';

export interface NavigationAdapter {
  getCurrentURL(): string;
  getCurrentState(): unknown;
  installHandler(interceptor: NavigationHandler): () => void;
  navigate(url: string, options?: NavigationNavigateOptions): Promise<void>;
}

export type NavigationHandler = (
  url: string,
  state: unknown,
  navigationType: NavigationType,
) => Promise<void> | void;

export interface NavigationScene {
  url: string;
  state: unknown;
  navigationType: NavigationType | null;
}

export interface BrowserAdapterOptions {
  location?: Location;
  navigation?: Navigation;
}

export interface HashAdapterOptions {
  location?: Location;
  navigation?: Navigation;
}

type URLLike = Pick<URL, 'pathname' | 'search' | 'hash'>;

export class NavigationContext {
  readonly adapter: NavigationAdapter;
  readonly scene: NavigationScene;

  constructor(adapter: NavigationAdapter, scene: NavigationScene) {
    this.adapter = adapter;
    this.scene = scene;
    DEBUG: {
      Object.freeze(this);
    }
  }
}

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

  installHandler(handler: NavigationHandler): () => void {
    const handleNavigate = (event: NavigateEvent) => {
      if (
        event.canIntercept &&
        event.destination.sameDocument &&
        event.downloadRequest === null &&
        !event.hashChange
      ) {
        event.intercept({
          async handler() {
            await handler(
              toRelativeUrl(new URL(event.destination.url)),
              event.destination.getState(),
              event.navigationType,
            );
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

  installHandler(handler: NavigationHandler): () => void {
    const handleNavigate = (event: NavigateEvent) => {
      if (
        event.canIntercept &&
        event.destination.sameDocument &&
        event.hashChange
      ) {
        event.intercept({
          async handler() {
            await handler(
              stripLeadingHashmark(new URL(event.destination.url).hash),
              event.destination.getState(),
              event.navigationType,
            );
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
  private readonly _handlers: Set<NavigationHandler> = new Set();

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

  installHandler(handler: NavigationHandler): () => void {
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

    for (const handler of this._handlers) {
      await handler(url, state, navigationType);
    }

    this._url = url;
    this._state = state;
  }
}

export function Navigation(
  adapter: NavigationAdapter,
  getUpdateOptions?: (scene: NavigationScene) => UpdateOptions,
): HookFunction<NavigationContext> {
  return (context) => {
    const [scene, setScene] = context.useState<NavigationScene>(() => ({
      url: adapter.getCurrentURL(),
      state: adapter.getCurrentState(),
      navigationType: null,
    }));

    context.useEffect(() => {
      return adapter.installHandler((url, state, navigationType) => {
        const scene: NavigationScene = { url, state, navigationType };
        const options = getUpdateOptions?.(scene);
        return setScene(scene, options).finished;
      });
    }, [adapter]);

    const navigationContext = new NavigationContext(adapter, scene);

    context.provide(navigationContext);

    return navigationContext;
  };
}

function stripLeadingHashmark(s: string): string {
  return s.startsWith('#') ? s.slice(1) : s;
}

function toRelativeUrl(url: URLLike): string {
  return url.pathname + url.search + url.hash;
}
