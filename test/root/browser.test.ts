import { describe, expect, it, vi } from 'vitest';
import { BrowserRenderHost } from '../../src/renderHost/browser.js';
import { createBrowserRoot } from '../../src/root/browser.js';
import { createElement } from '../testUtils.js';

describe('BrowserRoot', () => {
  it('mounts the value', async () => {
    const value1: string = 'foo';
    const value2: string = 'bar';
    const container = document.createElement('div');
    const renderHost = new BrowserRenderHost();
    const root = createBrowserRoot(value1, container, renderHost);

    const requestCallbackSpy = vi.spyOn(renderHost, 'requestCallback');

    await root.mount();

    expect(container.innerHTML).toBe('<!--foo-->');
    expect(requestCallbackSpy).toHaveBeenCalledTimes(2);
    expect(requestCallbackSpy).toHaveBeenNthCalledWith(
      1,
      expect.any(Function),
      {
        priority: 'user-blocking',
      },
    );

    await root.update(value2, {
      priority: 'user-blocking',
    });

    expect(container.innerHTML).toBe('<!--bar-->');
    expect(requestCallbackSpy).toHaveBeenCalledTimes(4);
    expect(requestCallbackSpy).toHaveBeenNthCalledWith(
      3,
      expect.any(Function),
      {
        priority: 'user-blocking',
      },
    );

    await root.unmount({
      priority: 'user-visible',
    });

    expect(container.innerHTML).toBe('');
    expect(requestCallbackSpy).toHaveBeenCalledTimes(6);
    expect(requestCallbackSpy).toHaveBeenNthCalledWith(
      5,
      expect.any(Function),
      {
        priority: 'user-visible',
      },
    );
  });

  it('hydrates the value', async () => {
    const value1: string = 'foo';
    const value2: string = 'bar';
    const container = createElement('div', {}, document.createComment(''));
    const root = createBrowserRoot(value1, container);

    await root.hydrate();

    expect(container.innerHTML).toBe('<!--foo-->');

    await root.update(value2);

    expect(container.innerHTML).toBe('<!--bar-->');

    await root.unmount();

    expect(container.innerHTML).toBe('');
  });
});
