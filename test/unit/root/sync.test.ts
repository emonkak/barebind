import { describe, expect, it, vi } from 'vitest';

import { createSyncRoot } from '@/root/sync.js';
import { MockHostEnvironment } from '../../mocks.js';
import { createElement } from '../../test-utils.js';

describe('SyncRoot', () => {
  describe('observe()', () => {
    it('adds the observer to the runtime', () => {
      const value = 'foo';
      const container = document.createElement('div');
      const host = new MockHostEnvironment();
      const root = createSyncRoot(value, container, host);
      const observer = { onRuntimeEvent: vi.fn() };

      const unsubscribe = root.observe(observer);

      root.mount();

      expect(observer.onRuntimeEvent).toHaveBeenCalled();
      expect(observer.onRuntimeEvent).toHaveBeenCalledWith({
        type: 'UPDATE_START',
        id: 0,
        priority: null,
        transition: false,
      });
      expect(observer.onRuntimeEvent).toHaveBeenCalledWith({
        type: 'UPDATE_END',
        id: 0,
        priority: null,
        transition: false,
      });

      const callCount = observer.onRuntimeEvent.mock.calls.length;

      unsubscribe();
      root.unmount();

      expect(observer.onRuntimeEvent).toHaveBeenCalledTimes(callCount);
    });
  });

  describe('mount()', () => {
    it('mounts the value', () => {
      const value1 = 'foo';
      const value2 = 'bar';
      const container = document.createElement('div');
      const host = new MockHostEnvironment();
      const root = createSyncRoot(value1, container, host);

      root.mount();

      expect(container.innerHTML).toBe('<!--foo-->');

      root.update(value2);

      expect(container.innerHTML).toBe('<!--bar-->');

      root.unmount();

      expect(container.innerHTML).toBe('');
    });
  });

  describe('hydrate()', () => {
    it('hydrates the value', async () => {
      const value1 = 'foo';
      const value2 = 'bar';
      const container = createElement('div', {}, document.createComment(''));
      const host = new MockHostEnvironment();
      const root = createSyncRoot(value1, container, host);

      root.hydrate();

      expect(container.innerHTML).toBe('<!--foo-->');

      root.update(value2);

      expect(container.innerHTML).toBe('<!--bar-->');

      root.unmount();

      expect(container.innerHTML).toBe('');
    });
  });
});
