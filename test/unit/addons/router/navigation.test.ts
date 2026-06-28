import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BrowserAdapter,
  HashAdapter,
  InMemoryAdapter,
} from '@/addons/router.js';

describe('BrowserAdapter', () => {
  let location: Location;
  let navigation: Navigation;
  let adapter: BrowserAdapter;

  beforeEach(() => {
    location = {
      hash: '',
      origin: 'http://localhost',
      pathname: '',
      search: '',
    } satisfies Partial<Location> as any;
    navigation = new MockNavigation() as Navigation;
    adapter = new BrowserAdapter({ navigation, location });
  });

  describe('getCurrentURL()', () => {
    it('returns the concatenation of location parts', () => {
      location.pathname = '/foo';
      location.search = '?bar';
      location.hash = '#baz';
      expect(adapter.getCurrentURL()).toBe('/foo?bar#baz');
    });
  });

  describe('getCurrentState()', () => {
    it('returns the state from navigation.currentEntry', () => {
      const state = { key: 'value' };
      vi.spyOn(navigation, 'currentEntry', 'get').mockReturnValue({
        getState: () => state,
      } as NavigationHistoryEntry);
      expect(adapter.getCurrentState()).toBe(state);
    });

    it('returns undefined when currentEntry is null', () => {
      expect(adapter.getCurrentState()).toBeUndefined();
    });
  });

  describe('installHandler()', () => {
    it('intercepts same-document non-hash navigate events', async () => {
      const state = { key: 'value' };
      const event = createNavigateEvent({
        canIntercept: true,
        destination: {
          id: '',
          index: 0,
          key: '',
          sameDocument: true,
          url: 'http://localhost/target',
          getState: () => state,
        },
        downloadRequest: null,
        hashChange: false,
        navigationType: 'push',
      });
      const handler = vi.fn();

      adapter.installHandler(handler);
      navigation.dispatchEvent(event);
      await Promise.resolve();

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith('/target', state, 'push');
      expect(event.intercept).toHaveBeenCalledOnce();
      expect(event.scroll).toHaveBeenCalledOnce();
    });

    it('does not intercept events that cannot be intercepted', () => {
      const event = createNavigateEvent({
        canIntercept: false,
        destination: {
          id: '',
          index: 0,
          key: '',
          sameDocument: true,
          url: 'http://localhost/target',
          getState: () => undefined,
        },
        downloadRequest: null,
        hashChange: false,
        navigationType: 'push',
      });
      const handler = vi.fn();

      adapter.installHandler(handler);
      navigation.dispatchEvent(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('does not intercept download requests', () => {
      const event = createNavigateEvent({
        canIntercept: true,
        destination: {
          id: '',
          index: 0,
          key: '',
          sameDocument: true,
          url: 'http://localhost/target',
          getState: () => undefined,
        },
        downloadRequest: 'file.zip',
        hashChange: false,
        navigationType: 'push',
      });
      const handler = vi.fn();

      adapter.installHandler(handler);
      navigation.dispatchEvent(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('does not intercept hashChange events', () => {
      const event = createNavigateEvent({
        canIntercept: true,
        destination: {
          id: '',
          index: 0,
          key: '',
          sameDocument: true,
          url: 'http://localhost/target',
          getState: () => undefined,
        },
        downloadRequest: null,
        hashChange: true,
        navigationType: 'push',
      });
      const handler = vi.fn();

      adapter.installHandler(handler);
      navigation.dispatchEvent(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('does not intercept cross-origin events', () => {
      const event = createNavigateEvent({
        canIntercept: true,
        destination: {
          id: '',
          index: 0,
          key: '',
          sameDocument: false,
          url: 'http://example.com/',
          getState: () => undefined,
        },
        downloadRequest: null,
        hashChange: false,
        navigationType: 'push',
      });
      const handler = vi.fn();

      adapter.installHandler(handler);
      navigation.dispatchEvent(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('removes the event listener on cleanup', () => {
      const handler = vi.fn();
      const cleanup = adapter.installHandler(handler);
      cleanup();

      navigation.dispatchEvent(createNavigateEvent({}));

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('navigate()', () => {
    it('delegates to navigation.navigate with the URL and options', () => {
      const navigateSpy = vi.spyOn(navigation, 'navigate');
      adapter.navigate('/foo', { state: { x: 1 }, history: 'push' });
      expect(navigateSpy).toHaveBeenCalledWith('/foo', {
        state: { x: 1 },
        history: 'push',
      });
    });
  });
});

describe('HashAdapter', () => {
  let location: Location;
  let navigation: Navigation;
  let adapter: HashAdapter;

  beforeEach(() => {
    location = {
      hash: '',
      origin: 'http://localhost',
      pathname: '',
      search: '',
    } satisfies Partial<Location> as any;
    navigation = new MockNavigation() as Navigation;
    adapter = new HashAdapter({ navigation, location });
  });

  describe('getCurrentURL()', () => {
    it('returns the hash without the leading #', () => {
      location.hash = '#/foo/bar';
      expect(adapter.getCurrentURL()).toBe('/foo/bar');
    });

    it('returns an empty string when the hash is empty', () => {
      expect(adapter.getCurrentURL()).toBe('');
    });

    it('returns an empty string when the hash is only #', () => {
      location.hash = '#';
      expect(adapter.getCurrentURL()).toBe('');
    });
  });

  describe('getCurrentState()', () => {
    it('returns the state from navigation.currentEntry', () => {
      const state = { key: 'value' };
      vi.spyOn(navigation, 'currentEntry', 'get').mockReturnValue({
        getState: () => state,
      } as NavigationHistoryEntry);
      expect(adapter.getCurrentState()).toBe(state);
    });

    it('returns undefined when currentEntry is null', () => {
      expect(adapter.getCurrentState()).toBeUndefined();
    });
  });

  describe('installHandler()', () => {
    it('intercepts hashChange events', async () => {
      const state = { key: 'value' };
      const event = createNavigateEvent({
        canIntercept: true,
        destination: {
          id: '',
          index: 0,
          key: '',
          sameDocument: true,
          url: 'http://localhost/#/target',
          getState: () => state,
        },
        downloadRequest: null,
        hashChange: true,
        navigationType: 'push',
      });
      const handler = vi.fn();

      adapter.installHandler(handler);
      navigation.dispatchEvent(event);
      await Promise.resolve();

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith('/target', state, 'push');
      expect(event.intercept).toHaveBeenCalledOnce();
      expect(event.scroll).toHaveBeenCalledOnce();
    });

    it('does not intercept non-hashChange events', () => {
      const event = createNavigateEvent({
        canIntercept: true,
        destination: {
          id: '',
          index: 0,
          key: '',
          sameDocument: true,
          url: 'http://localhost/target',
          getState: () => undefined,
        },
        downloadRequest: null,
        hashChange: false,
        navigationType: 'push',
      });
      const handler = vi.fn();

      adapter.installHandler(handler);
      navigation.dispatchEvent(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('does not intercept events that cannot be intercepted', () => {
      const event = createNavigateEvent({
        canIntercept: false,
        destination: {
          id: '',
          index: 0,
          key: '',
          sameDocument: true,
          url: 'http://localhost/#/target',
          getState: () => undefined,
        },
        downloadRequest: null,
        hashChange: true,
        navigationType: 'push',
      });
      const handler = vi.fn();

      adapter.installHandler(handler);
      navigation.dispatchEvent(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('does not intercept cross-origin events', () => {
      const event = createNavigateEvent({
        canIntercept: true,
        destination: {
          id: '',
          index: 0,
          key: '',
          sameDocument: false,
          url: 'http://example.com/',
          getState: () => undefined,
        },
        downloadRequest: null,
        hashChange: true,
        navigationType: 'push',
      });
      const handler = vi.fn();

      adapter.installHandler(handler);
      navigation.dispatchEvent(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('removes the event listener on cleanup', () => {
      const handler = vi.fn();
      const cleanup = adapter.installHandler(handler);
      cleanup();

      navigation.dispatchEvent(createNavigateEvent({}));

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('navigate()', () => {
    it('delegates to navigation.navigate with the #-prefixed URL', () => {
      const navigateSpy = vi.spyOn(navigation, 'navigate');
      adapter.navigate('/foo', { state: { x: 1 } });
      expect(navigateSpy).toHaveBeenCalledWith('#/foo', {
        state: { x: 1 },
      });
    });
  });
});

describe('InMemoryAdapter', () => {
  describe('getCurrentURL()', () => {
    it('returns the initial URL', () => {
      const adapter = new InMemoryAdapter('/foo', null);
      expect(adapter.getCurrentURL()).toBe('/foo');
    });
  });

  describe('getCurrentState()', () => {
    it('returns the initial state', () => {
      const adapter = new InMemoryAdapter('/foo', { key: 'val' });
      expect(adapter.getCurrentState()).toEqual({ key: 'val' });
    });

    it('returns undefined when no state is given', () => {
      const adapter = new InMemoryAdapter('/foo', undefined);
      expect(adapter.getCurrentState()).toBeUndefined();
    });
  });

  describe('installHandler()', () => {
    it('registers a handler and returns a cleanup function', () => {
      const adapter = new InMemoryAdapter('/foo', null);
      const handler = vi.fn();
      const cleanup = adapter.installHandler(handler);

      expect(cleanup).toBeInstanceOf(Function);
    });

    it('calls handlers on navigate', async () => {
      const adapter = new InMemoryAdapter('/foo', null);
      const handler = vi.fn();

      adapter.installHandler(handler);
      await adapter.navigate('/bar', { state: 42 });

      expect(handler).toHaveBeenCalledWith('/bar', 42, 'push');
    });

    it('calls all registered handlers on navigate', async () => {
      const adapter = new InMemoryAdapter('/foo', null);
      const h1 = vi.fn();
      const h2 = vi.fn();

      adapter.installHandler(h1);
      adapter.installHandler(h2);
      await adapter.navigate('/bar');

      expect(h1).toHaveBeenCalled();
      expect(h2).toHaveBeenCalled();
    });

    it('stops calling handlers after cleanup', async () => {
      const adapter = new InMemoryAdapter('/foo', null);
      const handler = vi.fn();

      const cleanup = adapter.installHandler(handler);
      cleanup();
      await adapter.navigate('/bar');

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('navigate()', () => {
    it('updates the URL after navigation', async () => {
      const adapter = new InMemoryAdapter('/foo', null);

      adapter.installHandler(() => {});
      await adapter.navigate('/bar');

      expect(adapter.getCurrentURL()).toBe('/bar');
    });

    it('updates the state after navigation', async () => {
      const adapter = new InMemoryAdapter('/foo', null);

      adapter.installHandler(() => {});
      await adapter.navigate('/bar', { state: 42 });

      expect(adapter.getCurrentState()).toBe(42);
    });

    it('defaults to push for a different URL', () => {
      const adapter = new InMemoryAdapter('/foo', null);
      const handler = vi.fn();

      adapter.installHandler(handler);
      adapter.navigate('/bar');

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith('/bar', undefined, 'push');
    });

    it('defaults to replace for the same URL', () => {
      const adapter = new InMemoryAdapter('/foo', null);
      const handler = vi.fn();

      adapter.installHandler(handler);
      adapter.navigate('/foo');

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith('/foo', undefined, 'replace');
    });

    it('uses the explicit history option when provided', () => {
      const adapter = new InMemoryAdapter('/foo', null);
      const handler = vi.fn();

      adapter.installHandler(handler);
      adapter.navigate('/bar', { history: 'replace' });

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith('/bar', undefined, 'replace');
    });
  });
});

class MockNavigation extends EventTarget implements Partial<Navigation> {
  get currentEntry(): NavigationHistoryEntry | null {
    return null;
  }

  navigate(
    _url: string,
    _options?: NavigationNavigateOptions,
  ): NavigationResult {
    return {};
  }
}

function createNavigateEvent(init: Partial<NavigateEvent>): NavigateEvent {
  return Object.assign(new Event('navigate'), {
    intercept: vi.fn((options) => options?.handler?.()),
    scroll: vi.fn(),
    ...init,
  } satisfies Partial<NavigateEvent>) as NavigateEvent;
}
