import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BrowserAdapter,
  HashAdapter,
  InMemoryAdapter,
} from '@/addons/router/adapter.js';

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

  describe('getCurrentState()', () => {
    it('returns the state from navigation.currentEntry', () => {
      const state = { key: 'value' };
      vi.spyOn(navigation, 'currentEntry', 'get').mockReturnValue({
        getState: () => state,
      } as NavigationHistoryEntry);
      expect(adapter.getCurrentState()).toBe(state);
    });

    it('returns undefined when currentEntry is null', () => {
      expect(adapter.getCurrentState()).toBe(undefined);
    });
  });

  describe('getCurrentURL()', () => {
    it('returns the concatenation of location parts', () => {
      location.pathname = '/foo';
      location.search = '?bar';
      location.hash = '#baz';
      expect(adapter.getCurrentURL()).toBe('/foo?bar#baz');
    });
  });

  describe('listen()', () => {
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
      const listener = vi.fn();

      adapter.listen(listener);
      navigation.dispatchEvent(event);
      await Promise.resolve();

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(
        {
          url: '/target',
          state,
          navigationType: 'push',
        },
        expect.any(Event),
      );
    });

    it('does not listen events that cannot be intercepted', () => {
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
      const listener = vi.fn();

      adapter.listen(listener);
      navigation.dispatchEvent(event);

      expect(listener).not.toHaveBeenCalled();
    });

    it('does not listen download requests', () => {
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
      const listener = vi.fn();

      adapter.listen(listener);
      navigation.dispatchEvent(event);

      expect(listener).not.toHaveBeenCalled();
    });

    it('does not listen hashChange events', () => {
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
      const listener = vi.fn();

      adapter.listen(listener);
      navigation.dispatchEvent(event);

      expect(listener).not.toHaveBeenCalled();
    });

    it('does not listen cross-origin events', () => {
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
      const listener = vi.fn();

      adapter.listen(listener);
      navigation.dispatchEvent(event);

      expect(listener).not.toHaveBeenCalled();
    });

    it('removes the event listener on cleanup', () => {
      const listener = vi.fn();
      const cleanup = adapter.listen(listener);
      cleanup();

      navigation.dispatchEvent(createNavigateEvent({}));

      expect(listener).not.toHaveBeenCalled();
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

  describe('getCurrentState()', () => {
    it('returns the state from navigation.currentEntry', () => {
      const state = { key: 'value' };
      vi.spyOn(navigation, 'currentEntry', 'get').mockReturnValue({
        getState: () => state,
      } as NavigationHistoryEntry);
      expect(adapter.getCurrentState()).toBe(state);
    });

    it('returns undefined when currentEntry is null', () => {
      expect(adapter.getCurrentState()).toBe(undefined);
    });
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

  describe('listen()', () => {
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
      const listener = vi.fn();

      adapter.listen(listener);
      navigation.dispatchEvent(event);
      await Promise.resolve();

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(
        {
          url: '/target',
          state,
          navigationType: 'push',
        },
        expect.any(Event),
      );
    });

    it('does not listen non-hashChange events', () => {
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
      const listener = vi.fn();

      adapter.listen(listener);
      navigation.dispatchEvent(event);

      expect(listener).not.toHaveBeenCalled();
    });

    it('does not listen events that cannot be intercepted', () => {
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
      const listener = vi.fn();

      adapter.listen(listener);
      navigation.dispatchEvent(event);

      expect(listener).not.toHaveBeenCalled();
    });

    it('does not listen cross-origin events', () => {
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
      const listener = vi.fn();

      adapter.listen(listener);
      navigation.dispatchEvent(event);

      expect(listener).not.toHaveBeenCalled();
    });

    it('removes the event listener on cleanup', () => {
      const listener = vi.fn();
      const cleanup = adapter.listen(listener);
      cleanup();

      navigation.dispatchEvent(createNavigateEvent({}));

      expect(listener).not.toHaveBeenCalled();
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
  describe('getCurrentState()', () => {
    it('returns the initial state', () => {
      const adapter = new InMemoryAdapter('/foo', { key: 'val' });
      expect(adapter.getCurrentState()).toEqual({ key: 'val' });
    });

    it('returns undefined when no state is given', () => {
      const adapter = new InMemoryAdapter('/foo', undefined);
      expect(adapter.getCurrentState()).toBe(undefined);
    });
  });

  describe('getCurrentURL()', () => {
    it('returns the initial URL', () => {
      const adapter = new InMemoryAdapter('/foo', null);
      expect(adapter.getCurrentURL()).toBe('/foo');
    });
  });

  describe('listen()', () => {
    it('registers a listener and returns a cleanup function', () => {
      const adapter = new InMemoryAdapter('/foo', null);
      const listener = vi.fn();
      const cleanup = adapter.listen(listener);

      expect(cleanup).toBeInstanceOf(Function);
    });

    it('calls the listener on navigate', async () => {
      const adapter = new InMemoryAdapter('/foo', null);
      const listener = vi.fn();

      adapter.listen(listener);
      await adapter.navigate('/bar', { state: 42 });

      expect(listener).toHaveBeenCalledWith(
        {
          url: '/bar',
          state: 42,
          navigationType: 'push',
        },
        {
          intercept: expect.any(Function),
          scroll: expect.any(Function),
        },
      );
    });

    it('calls all registered listeners on navigate', async () => {
      const adapter = new InMemoryAdapter('/foo', null);
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      adapter.listen(listener1);
      adapter.listen(listener2);
      await adapter.navigate('/bar');

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('stops calling the listener after cleanup', async () => {
      const adapter = new InMemoryAdapter('/foo', null);
      const listener = vi.fn();

      const cleanup = adapter.listen(listener);
      cleanup();
      await adapter.navigate('/bar');

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('navigate()', () => {
    it('updates the URL after navigation', async () => {
      const adapter = new InMemoryAdapter('/foo', null);

      adapter.listen(() => {});
      await adapter.navigate('/bar');

      expect(adapter.getCurrentURL()).toBe('/bar');
    });

    it('updates the state after navigation', async () => {
      const adapter = new InMemoryAdapter('/foo', null);

      adapter.listen(() => {});
      await adapter.navigate('/bar', { state: 42 });

      expect(adapter.getCurrentState()).toBe(42);
    });

    it('defaults to push for a different URL', () => {
      const adapter = new InMemoryAdapter('/foo', null);
      const listener = vi.fn();

      adapter.listen(listener);
      adapter.navigate('/bar');

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(
        {
          url: '/bar',
          state: undefined,
          navigationType: 'push',
        },
        {
          intercept: expect.any(Function),
          scroll: expect.any(Function),
        },
      );
    });

    it('defaults to replace for the same URL', () => {
      const adapter = new InMemoryAdapter('/foo', null);
      const listener = vi.fn();

      adapter.listen(listener);
      adapter.navigate('/foo');

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(
        {
          url: '/foo',
          state: undefined,
          navigationType: 'replace',
        },

        {
          intercept: expect.any(Function),
          scroll: expect.any(Function),
        },
      );
    });

    it('uses the explicit history option when provided', () => {
      const adapter = new InMemoryAdapter('/foo', null);
      const listener = vi.fn();

      adapter.listen(listener);
      adapter.navigate('/bar', { history: 'replace' });

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(
        {
          url: '/bar',
          state: undefined,
          navigationType: 'replace',
        },
        {
          intercept: expect.any(Function),
          scroll: expect.any(Function),
        },
      );
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
