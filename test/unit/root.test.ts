import { describe, expect, it, vi } from 'vitest';
import { Lanes } from '@/internal.js';
import { Root } from '@/root.js';
import { MockBackend } from '../mocks.js';
import { createElement } from '../test-helpers.js';

describe('Root', () => {
  describe('observe()', () => {
    it('registers an observer to the runtime', async () => {
      const value = 'foo';
      const container = document.createElement('div');
      const backend = new MockBackend();
      const root = Root.create(value, container, backend);
      const observer = { onRuntimeEvent: vi.fn() };

      const unsubscribe = root.observe(observer);

      await root.mount();

      expect(observer.onRuntimeEvent).toHaveBeenCalled();
      expect(observer.onRuntimeEvent).toHaveBeenCalledWith({
        type: 'UPDATE_START',
        id: 1,
        lanes: Lanes.DefaultLane | Lanes.UserBlockingLane,
      });
      expect(observer.onRuntimeEvent).toHaveBeenCalledWith({
        type: 'UPDATE_END',
        id: 1,
        lanes: Lanes.DefaultLane | Lanes.UserBlockingLane,
      });

      const callCount = observer.onRuntimeEvent.mock.calls.length;

      unsubscribe();
      await root.unmount();

      expect(observer.onRuntimeEvent).toHaveBeenCalledTimes(callCount);
    });
  });

  describe('mount()', () => {
    it('mounts a value', async () => {
      const value1 = 'foo';
      const value2 = 'bar';
      const container = document.createElement('div');
      const backend = new MockBackend();
      const root = Root.create(value1, container, backend);

      await root.mount();

      expect(container.innerHTML).toBe('<!--foo-->');

      await root.update(value2);

      expect(container.innerHTML).toBe('<!--bar-->');

      await root.unmount();

      expect(container.innerHTML).toBe('');
    });
  });

  describe('hydrate()', () => {
    it('hydrates a value', async () => {
      const value1 = 'foo';
      const value2 = 'bar';
      const container = createElement('div', {}, document.createComment(''));
      const backend = new MockBackend();
      const root = Root.create(value1, container, backend);

      await root.hydrate();

      expect(container.innerHTML).toBe('<!--foo-->');

      await root.update(value2);

      expect(container.innerHTML).toBe('<!--bar-->');

      await root.unmount();

      expect(container.innerHTML).toBe('');
    });
  });
});
