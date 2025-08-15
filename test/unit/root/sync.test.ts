import { describe, expect, it, vi } from 'vitest';
import { Lanes } from '@/internal.js';
import { SyncRoot } from '@/root/sync.js';
import { MockBackend } from '../../mocks.js';
import { createElement } from '../../test-utils.js';

describe('SyncRoot', () => {
  describe('static create()', () => {
    it('returns a SyncRoot without concurrent mode', () => {
      const value = 'foo';
      const container = document.createElement('div');
      const backend = new MockBackend();
      const root = SyncRoot.create(value, container, backend);

      expect(root['_runtime']['_environment'].concurrent).toBe(false);
    });
  });

  describe('observe()', () => {
    it('registers an observer to the runtime', () => {
      const value = 'foo';
      const container = document.createElement('div');
      const backend = new MockBackend();
      const root = SyncRoot.create(value, container, backend);
      const observer = { onRuntimeEvent: vi.fn() };

      const unsubscribe = root.observe(observer);

      root.mount();

      expect(observer.onRuntimeEvent).toHaveBeenCalled();
      expect(observer.onRuntimeEvent).toHaveBeenCalledWith({
        type: 'UPDATE_START',
        id: 0,
        lanes: Lanes.NoLanes,
      });
      expect(observer.onRuntimeEvent).toHaveBeenCalledWith({
        type: 'UPDATE_END',
        id: 0,
        lanes: Lanes.NoLanes,
      });

      const callCount = observer.onRuntimeEvent.mock.calls.length;

      unsubscribe();
      root.unmount();

      expect(observer.onRuntimeEvent).toHaveBeenCalledTimes(callCount);
    });
  });

  describe('mount()', () => {
    it('mounts a value', () => {
      const value1 = 'foo';
      const value2 = 'bar';
      const container = document.createElement('div');
      const backend = new MockBackend();
      const root = SyncRoot.create(value1, container, backend);

      root.mount();

      expect(container.innerHTML).toBe('<!--foo-->');

      root.update(value2);

      expect(container.innerHTML).toBe('<!--bar-->');

      root.unmount();

      expect(container.innerHTML).toBe('');
    });
  });

  describe('hydrate()', () => {
    it('hydrates a value', async () => {
      const value1 = 'foo';
      const value2 = 'bar';
      const container = createElement('div', {}, document.createComment(''));
      const backend = new MockBackend();
      const root = SyncRoot.create(value1, container, backend);

      root.hydrate();

      expect(container.innerHTML).toBe('<!--foo-->');

      root.update(value2);

      expect(container.innerHTML).toBe('<!--bar-->');

      root.unmount();

      expect(container.innerHTML).toBe('');
    });
  });
});
