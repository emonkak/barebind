import { describe, expect, it, vi } from 'vitest';
import { createAsyncRoot } from '@/root/async.js';
import { MockRenderHost } from '../../mocks.js';
import { createElement } from '../../testUtils.js';

describe('AsyncRoot', () => {
  describe('observe()', () => {
    it('adds the observer to the runtime', async () => {
      const value = 'foo';
      const container = document.createElement('div');
      const renderHost = new MockRenderHost();
      const root = createAsyncRoot(value, container, renderHost);
      const observer = { onRuntimeEvent: vi.fn() };

      const unsubscribe = root.observe(observer);

      await root.mount();

      expect(observer.onRuntimeEvent).toHaveBeenCalled();
      expect(observer.onRuntimeEvent).toHaveBeenCalledWith({
        type: 'UPDATE_START',
        id: 0,
        options: {
          priority: 'user-blocking',
        },
      });
      expect(observer.onRuntimeEvent).toHaveBeenCalledWith({
        type: 'UPDATE_END',
        id: 0,
        options: {
          priority: 'user-blocking',
        },
      });

      const callCount = observer.onRuntimeEvent.mock.calls.length;

      unsubscribe();
      await root.unmount();

      expect(observer.onRuntimeEvent).toHaveBeenCalledTimes(callCount);
    });
  });

  describe('mount()', () => {
    it('mounts the value', async () => {
      const value1 = 'foo';
      const value2 = 'bar';
      const container = document.createElement('div');
      const renderHost = new MockRenderHost();
      const root = createAsyncRoot(value1, container, renderHost);

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
        priority: 'background',
      });

      expect(container.innerHTML).toBe('<!--bar-->');
      expect(requestCallbackSpy).toHaveBeenCalledTimes(4);
      expect(requestCallbackSpy).toHaveBeenNthCalledWith(
        3,
        expect.any(Function),
        {
          priority: 'background',
        },
      );

      await root.unmount();

      expect(container.innerHTML).toBe('');
      expect(requestCallbackSpy).toHaveBeenCalledTimes(6);
      expect(requestCallbackSpy).toHaveBeenNthCalledWith(
        5,
        expect.any(Function),
        {
          priority: 'user-blocking',
        },
      );
    });
  });

  describe('hydrate()', () => {
    it('hydrates the value', async () => {
      const value1 = 'foo';
      const value2 = 'bar';
      const container = createElement('div', {}, document.createComment(''));
      const renderHost = new MockRenderHost();
      const root = createAsyncRoot(value1, container, renderHost);

      await root.hydrate();

      expect(container.innerHTML).toBe('<!--foo-->');

      await root.update(value2);

      expect(container.innerHTML).toBe('<!--bar-->');

      await root.unmount();

      expect(container.innerHTML).toBe('');
    });
  });
});
