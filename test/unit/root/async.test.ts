import { describe, expect, it, vi } from 'vitest';
import { Lanes } from '@/core.js';
import { AsyncRoot } from '@/root/async.js';
import { MockBackend } from '../../mocks.js';
import { createElement } from '../../test-utils.js';

describe('AsyncRoot', () => {
  describe('static create()', () => {
    it('returns a AsyncRoot with concurrent mode', () => {
      const value = 'foo';
      const container = document.createElement('div');
      const backend = new MockBackend();
      const root = AsyncRoot.create(value, container, backend);

      expect(root['_runtime']['_environment'].concurrent).toBe(true);
    });
  });

  describe('observe()', () => {
    it('registers an observer to the runtime', async () => {
      const value = 'foo';
      const container = document.createElement('div');
      const backend = new MockBackend();
      const root = AsyncRoot.create(value, container, backend);
      const observer = { onRuntimeEvent: vi.fn() };

      const unsubscribe = root.observe(observer);

      await root.mount();

      expect(observer.onRuntimeEvent).toHaveBeenCalled();
      expect(observer.onRuntimeEvent).toHaveBeenCalledWith({
        type: 'UPDATE_START',
        id: 0,
        lanes: Lanes.SyncLane | Lanes.ConcurrentLane,
      });
      expect(observer.onRuntimeEvent).toHaveBeenCalledWith({
        type: 'UPDATE_END',
        id: 0,
        lanes: Lanes.SyncLane | Lanes.ConcurrentLane,
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
      const root = AsyncRoot.create(value1, container, backend);

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
      const root = AsyncRoot.create(value1, container, backend);

      await root.hydrate();

      expect(container.innerHTML).toBe('<!--foo-->');

      await root.update(value2);

      expect(container.innerHTML).toBe('<!--bar-->');

      await root.unmount();

      expect(container.innerHTML).toBe('');
    });
  });
});
