import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BrowserHistory,
  createFormSubmitHandler,
  createLinkClickHandler,
} from '@/addons/router/browser-history.js';
import {
  HistoryContext,
  type HistoryNavigator,
} from '@/addons/router/history.js';
import { RelativeURL } from '@/addons/router/relative-url.js';
import type { UpdateOptions } from '@/internal.js';
import { createElement } from '../../../test-helpers.js';
import { TestRenderer } from '../../../test-renderer.js';

describe('BrowserHistory()', () => {
  const originalURL = location.href;
  const originalState = history.state;

  const renderer = new TestRenderer((options: UpdateOptions, session) => {
    session.use(BrowserHistory(options));
    return session.use(HistoryContext);
  });

  afterEach(() => {
    renderer.finalize();
    renderer.reset();
    history.replaceState(originalState, '', originalURL);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('HistoryNavigator', () => {
    it('gets the current URL', () => {
      const state = { key: 'foo' };

      history.replaceState(state, '', '/foo/bar');

      SESSION: {
        const { location, navigator } = renderer.render({});

        expect(location.url.toString()).toBe('/foo/bar');
        expect(location.state).toStrictEqual(state);
        expect(location.navigationType).toBe(null);
        expect(navigator.getCurrentURL().toString()).toBe(
          location.url.toString(),
        );
        expect(history.state).toStrictEqual(state);
      }
    });

    it('pushes a new location', () => {
      const pushStateSpy = vi.spyOn(history, 'pushState');
      const replaceStateSpy = vi.spyOn(history, 'replaceState');
      const scheduleUpdateSpy = vi.spyOn(renderer.runtime, 'scheduleUpdate');

      let stableNavigator: HistoryNavigator;

      SESSION1: {
        const { location, navigator } = renderer.render({
          viewTransition: true,
        });

        expect(location.url.toString()).toBe(
          RelativeURL.fromString(originalURL).toString(),
        );
        expect(location.state).toBe(originalState);
        expect(location.navigationType).toBe(null);

        stableNavigator = navigator;
      }

      stableNavigator.navigate('/articles/456');

      expect(scheduleUpdateSpy).toHaveBeenLastCalledWith(expect.any(Object), {
        immediate: true,
        viewTransition: true,
      });

      SESSION2: {
        const { location, navigator } = renderer.render({
          viewTransition: true,
        });

        expect(pushStateSpy).toHaveBeenCalledOnce();
        expect(replaceStateSpy).not.toHaveBeenCalled();

        expect(location.url.toString()).toBe('/articles/456');
        expect(location.state).toBe(null);
        expect(location.navigationType).toBe('push');
        expect(navigator).toBe(stableNavigator);
      }

      expect(scheduleUpdateSpy).toHaveBeenCalledTimes(3);
    });

    it('replaces with a new location', () => {
      const state = { key: 'foo' };

      const scheduleUpdateSpy = vi.spyOn(renderer.runtime, 'scheduleUpdate');
      const pushStateSpy = vi.spyOn(history, 'pushState');
      const replaceStateSpy = vi.spyOn(history, 'replaceState');

      let stableNavigator: HistoryNavigator;

      SESSION1: {
        const { location, navigator } = renderer.render({
          viewTransition: true,
        });

        expect(location.url.toString()).toBe(
          RelativeURL.fromString(originalURL).toString(),
        );
        expect(location.state).toBe(originalState);
        expect(location.navigationType).toBe(null);

        stableNavigator = navigator;
      }

      stableNavigator.navigate('/foo/bar', {
        replace: true,
        state,
      });

      expect(scheduleUpdateSpy).toHaveBeenLastCalledWith(expect.any(Object), {
        immediate: true,
        viewTransition: true,
      });

      SESSION2: {
        const { location, navigator } = renderer.render({
          viewTransition: true,
        });

        expect(pushStateSpy).not.toHaveBeenCalled();
        expect(replaceStateSpy).toHaveBeenCalledOnce();
        expect(location.url.toString()).toBe('/foo/bar');
        expect(location.state).toBe(state);
        expect(location.navigationType).toBe('replace');
        expect(navigator).toBe(stableNavigator);
      }

      expect(scheduleUpdateSpy).toHaveBeenCalledTimes(3);
    });

    it('waits for navigation transition', async () => {
      const { navigator } = renderer.render({});

      navigator.navigate('/articles/foo%2Fbar');

      expect(navigator.isTransitionPending()).toBe(true);

      expect(await navigator.waitForTransition()).toBe(1);

      expect(navigator.isTransitionPending()).toBe(false);

      expect(await navigator.waitForTransition()).toBe(0);
    });
  });

  it('registers event listeners for "click", "submit" and "popstate"', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    vi.stubGlobal('navigation', undefined);

    renderer.render({});
    renderer.finalize();

    expect(addEventListenerSpy).toHaveBeenCalledTimes(3);
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'click',
      expect.any(Function),
    );
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'submit',
      expect.any(Function),
    );
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'popstate',
      expect.any(Function),
    );
    expect(removeEventListenerSpy).toHaveBeenCalledTimes(3);
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'click',
      expect.any(Function),
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'submit',
      expect.any(Function),
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'popstate',
      expect.any(Function),
    );
  });

  it.runIf(typeof navigation === 'object')(
    'registers event listeners for "click", "submit" and "navigate" if Navigation API is available',
    () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const addNavigationEventListenerSpy = vi.spyOn(
        navigation!,
        'addEventListener',
      );
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const removeNavigationEventListenerSpy = vi.spyOn(
        navigation!,
        'removeEventListener',
      );

      renderer.render({});
      renderer.finalize();

      expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
      );
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'submit',
        expect.any(Function),
      );
      expect(addNavigationEventListenerSpy).toHaveBeenCalledTimes(1);
      expect(addNavigationEventListenerSpy).toHaveBeenCalledWith(
        'navigate',
        expect.any(Function),
      );
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(2);
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
      );
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'submit',
        expect.any(Function),
      );
      expect(removeNavigationEventListenerSpy).toHaveBeenCalledTimes(1);
      expect(removeNavigationEventListenerSpy).toHaveBeenCalledWith(
        'navigate',
        expect.any(Function),
      );
    },
  );

  it('should update the state when the link is clicked', () => {
    const scheduleUpdateSpy = vi.spyOn(renderer.runtime, 'scheduleUpdate');

    SESSION1: {
      renderer.render({ viewTransition: true });
    }

    const element = createElement('a', { href: '/foo/bar' });
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    expect(scheduleUpdateSpy).toHaveBeenLastCalledWith(expect.any(Object), {
      immediate: true,
      viewTransition: true,
    });

    SESSION2: {
      const { location } = renderer.render({ viewTransition: true });

      expect(location.url.toString()).toBe('/foo/bar');
      expect(location.state).toBe(null);
    }

    expect(scheduleUpdateSpy).toHaveBeenCalledTimes(3);
  });

  it('should update the state when the form is submitted', () => {
    const scheduleUpdateSpy = vi.spyOn(renderer.runtime, 'scheduleUpdate');

    SESSION1: {
      renderer.render({ viewTransition: true });
    }

    const element = createElement('form', {
      method: 'GET',
      action: '/foo/bar',
    });
    document.body.appendChild(element);
    element.dispatchEvent(
      new SubmitEvent('submit', {
        bubbles: true,
        cancelable: true,
      }),
    );
    document.body.removeChild(element);

    expect(scheduleUpdateSpy).toHaveBeenLastCalledWith(expect.any(Object), {
      immediate: true,
      viewTransition: true,
    });

    SESSION2: {
      const { location } = renderer.render({ viewTransition: true });

      expect(location.url.toString()).toBe('/foo/bar');
      expect(location.state).toBe(null);
    }

    expect(scheduleUpdateSpy).toHaveBeenCalledTimes(3);
  });

  it.runIf(typeof navigation === 'object')(
    'should update the location when NavigateEvent is received',
    () => {
      const state = { key: 'foo' };

      const scheduleUpdateSpy = vi.spyOn(renderer.runtime, 'scheduleUpdate');

      SESSION1: {
        renderer.render({ viewTransition: true });
      }

      navigation!.dispatchEvent(
        Object.assign(new Event('navigate'), {
          hashChange: true,
          navigationType: 'traverse',
          destination: {
            url: location.origin + '/foo/bar',
            getState() {
              return state;
            },
          },
        } as NavigateEventInit),
      );

      expect(scheduleUpdateSpy).toHaveBeenLastCalledWith(expect.any(Object), {
        immediate: true,
        viewTransition: true,
      });

      SESSION2: {
        const { location } = renderer.render({ viewTransition: true });

        expect(location.url.toString()).toBe('/foo/bar');
        expect(location.state).toBe(state);
        expect(location.navigationType).toBe('traverse');
      }

      expect(scheduleUpdateSpy).toHaveBeenCalledTimes(3);
    },
  );

  it('should update the location when PopStateEvent is received', () => {
    const state = { key: 'foo' };

    const scheduleUpdateSpy = vi.spyOn(renderer.runtime, 'scheduleUpdate');

    vi.stubGlobal('navigation', undefined);

    SESSION1: {
      renderer.render({ viewTransition: true });
    }

    history.replaceState(state, '', '/foo/bar');
    dispatchEvent(
      new PopStateEvent('popstate', {
        state,
      }),
    );

    expect(scheduleUpdateSpy).toHaveBeenLastCalledWith(expect.any(Object), {
      immediate: true,
      viewTransition: true,
    });

    SESSION2: {
      const { location } = renderer.render({ viewTransition: true });

      expect(location.url.toString()).toBe('/foo/bar');
      expect(location.state).toBe(state);
      expect(location.navigationType).toBe('traverse');
    }

    expect(scheduleUpdateSpy).toHaveBeenCalledTimes(3);
  });

  it('should not update the location when only the hash has been changed', () => {
    const state = { key: 'foo' };

    const scheduleUpdateSpy = vi.spyOn(renderer.runtime, 'scheduleUpdate');

    vi.stubGlobal('navigation', undefined);

    SESSION1: {
      renderer.render({ viewTransition: true });
    }

    history.replaceState(state, '', '#foo');
    dispatchEvent(new PopStateEvent('popstate', { state }));

    SESSION2: {
      renderer.render({ viewTransition: true });
    }

    expect(scheduleUpdateSpy).toHaveBeenCalledTimes(2);
  });
});

describe('createLinkClickHandler()', () => {
  it('should push a new URL', () => {
    const container = createElement('div');
    const element = createElement('a', {
      href: '/foo?bar=123#baz',
    });
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });

    const navigate = vi.fn();
    const clickHandler = vi.fn(createLinkClickHandler({ navigate }));

    container.addEventListener('click', clickHandler);
    container.appendChild(element);
    element.dispatchEvent(event);

    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/foo',
        search: '?bar=123',
        hash: '#baz',
      }),
      { replace: false },
    );
    expect(clickHandler).toHaveBeenCalledOnce();
    expect(clickHandler).toHaveBeenCalledWith(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('should replace the location if the element indicates the same location', () => {
    const container = createElement('div');
    const element = createElement('a', {
      href: location.href,
    });
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });

    const navigate = vi.fn();
    const clickHandler = vi.fn(createLinkClickHandler({ navigate }));

    container.appendChild(element);
    container.addEventListener('click', clickHandler);
    element.dispatchEvent(event);

    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      }),
      { replace: true },
    );
    expect(clickHandler).toHaveBeenCalledOnce();
    expect(clickHandler).toHaveBeenCalledWith(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('should replace the location if the element has "data-link-replace" attribute', () => {
    const container = createElement('div');
    const element = createElement('a', {
      href: '/foo?bar=123#baz',
      'data-link-replace': '',
      'data-link-no-scroll-reset': '',
    });
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });

    const navigate = vi.fn();
    const clickHandler = vi.fn(createLinkClickHandler({ navigate }));

    container.appendChild(element);
    container.addEventListener('click', clickHandler);
    element.dispatchEvent(event);

    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/foo',
        search: '?bar=123',
        hash: '#baz',
      }),
      { replace: true },
    );
    expect(clickHandler).toHaveBeenCalledOnce();
    expect(clickHandler).toHaveBeenCalledWith(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('should ignore the event if the location differs only in the hash', () => {
    const container = createElement('div');
    const element = createElement('a', {
      href: '#foo?bar=123#baz',
    });
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });

    const navigate = vi.fn();
    const clickHandler = vi.fn(createLinkClickHandler({ navigate }));

    container.appendChild(element);
    container.addEventListener('click', clickHandler);
    element.dispatchEvent(event);

    expect(navigate).not.toHaveBeenCalled();
    expect(clickHandler).toHaveBeenCalledOnce();
    expect(clickHandler).toHaveBeenCalledWith(event);
    expect(location.hash).toBe(element.hash);
    expect(event.defaultPrevented).toBe(false);
  });

  it.for([
    { altKey: true, bubbles: true },
    { ctrlKey: true, bubbles: true },
    { metaKey: true, bubbles: true },
    { shiftKey: true, bubbles: true },
    { button: 1, bubbles: true },
  ])('should ignore the event if any modifier keys or the button other than left button are pressed', (eventInit) => {
    const container = createElement('div');
    const element = createElement('a');
    const event = new MouseEvent('click', eventInit);

    const navigate = vi.fn();
    const clickHandler = vi.fn(createLinkClickHandler({ navigate }));

    container.appendChild(element);
    container.addEventListener('click', clickHandler);
    element.dispatchEvent(event);

    expect(navigate).not.toHaveBeenCalled();
    expect(clickHandler).toHaveBeenCalledOnce();
    expect(clickHandler).toHaveBeenCalledWith(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('should ignore the event if its default action is prevented', () => {
    const container = createElement('div');
    const element = createElement('a');
    const event = new MouseEvent('click', { cancelable: true, bubbles: true });

    const navigate = vi.fn();
    const clickHandler = vi.fn(createLinkClickHandler({ navigate }));

    event.preventDefault();
    container.appendChild(element);
    container.addEventListener('click', clickHandler);
    element.dispatchEvent(event);

    expect(navigate).not.toHaveBeenCalled();
    expect(clickHandler).toHaveBeenCalledOnce();
    expect(clickHandler).toHaveBeenCalledWith(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it.each([
    ['a', { href: '#/foo' }],
    ['a', { href: '/foo', download: '' }],
    ['a', { href: '/foo', rel: 'external' }],
    ['a', { href: '/foo', target: '_blank' }],
    ['a', {}],
    ['button', {}],
  ] as const)('should ignore the event if the target is not valid as a link', (tagName, attribues) => {
    const cancelWrapper = createElement('div');
    const container = createElement('div');
    const element = createElement(tagName, attribues);
    const event = new MouseEvent('click', {
      cancelable: true,
      bubbles: true,
    });

    const navigate = vi.fn();
    const clickHandler = vi.fn(createLinkClickHandler({ navigate }));
    const cancelHandler = vi.fn((event: Event) => {
      event.preventDefault();
    });

    cancelWrapper.appendChild(container);
    cancelWrapper.addEventListener('click', cancelHandler);
    container.appendChild(element);
    container.addEventListener('click', clickHandler);
    element.dispatchEvent(event);

    expect(navigate).not.toHaveBeenCalled();
    expect(clickHandler).toHaveBeenCalledOnce();
    expect(clickHandler).toHaveBeenCalledWith(event);
    expect(cancelHandler).toHaveBeenCalledOnce();
    expect(cancelHandler).toHaveBeenCalledWith(event);
  });
});

describe('createFormSubmitHandler()', () => {
  it('should push a new location when the from is submitted', () => {
    const form = createElement(
      'form',
      {
        method: 'GET',
        action: '/foo?bar=123#baz',
      },
      createElement('input', { type: 'hidden', name: 'qux', value: '456' }),
    );
    const event = new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
    });

    const navigate = vi.fn();
    const formSubmitHandler = vi.fn(createFormSubmitHandler({ navigate }));

    form.addEventListener('submit', formSubmitHandler);
    form.dispatchEvent(event);

    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/foo',
        search: '?qux=456',
        hash: '#baz',
      }),
      { replace: false },
    );
    expect(formSubmitHandler).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('should push a new location when the from is submitted by the button', () => {
    const form = createElement(
      'form',
      {
        method: 'POST',
        action: '/',
      },

      createElement('button', {
        type: 'submit',
        formmethod: 'GET',
        formaction: '/foo?bar=123#baz',
        name: 'qux',
        value: '456',
      }),
    );
    const event = new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
      submitter: form.querySelector('button'),
    });

    const navigate = vi.fn();
    const formSubmitHandler = vi.fn(createFormSubmitHandler({ navigate }));

    form.addEventListener('submit', formSubmitHandler);
    form.dispatchEvent(event);

    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/foo',
        search: '?qux=456',
        hash: '#baz',
      }),
      { replace: false },
    );
    expect(formSubmitHandler).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('should replace a new location when the form is submitted', () => {
    const form = createElement(
      'form',
      {
        method: 'GET',
        action: '/foo?bar=123#baz',
        'data-link-replace': '',
        'data-link-no-scroll-reset': '',
      },
      createElement('input', {
        type: 'hidden',
        name: 'qux',
        value: '456',
      }),
    );
    const event = new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
    });

    const navigate = vi.fn();
    const formSubmitHandler = vi.fn(createFormSubmitHandler({ navigate }));

    form.addEventListener('submit', formSubmitHandler);
    form.dispatchEvent(event);

    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/foo',
        search: '?qux=456',
        hash: '#baz',
      }),
      { replace: true },
    );
    expect(formSubmitHandler).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('should ignore the event if its default action is prevented', () => {
    const form = createElement('form', {
      method: 'GET',
      action: '/foo?bar=123#baz',
    });
    const event = new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
    });

    const navigate = vi.fn();
    const formSubmitHandler = vi.fn(createFormSubmitHandler({ navigate }));

    event.preventDefault();
    form.addEventListener('submit', formSubmitHandler);
    form.dispatchEvent(event);

    expect(navigate).not.toHaveBeenCalled();
    expect(formSubmitHandler).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('should ignore the event if the form method is not "GET"', () => {
    const form = createElement('form', {
      method: 'POST',
      action: '/foo?bar=123#baz',
    });
    const event = new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
    });

    const navigate = vi.fn();
    const formSubmitHandler = vi.fn(createFormSubmitHandler({ navigate }));

    form.addEventListener('submit', formSubmitHandler);
    form.dispatchEvent(event);

    expect(navigate).not.toHaveBeenCalled();
    expect(formSubmitHandler).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(false);
  });

  it('should ignore the event If the origin of the action is different from the current location', () => {
    const form = createElement('form', {
      method: 'GET',
      action: 'https://example.com',
    });
    const event = new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
    });

    const navigate = vi.fn();
    const formSubmitHandler = vi.fn(createFormSubmitHandler({ navigate }));

    form.addEventListener('submit', formSubmitHandler);
    form.dispatchEvent(event);

    expect(navigate).not.toHaveBeenCalled();
    expect(formSubmitHandler).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(false);
  });
});
