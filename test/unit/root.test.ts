import { describe, expect, it, vi } from 'vitest';
import { Lanes } from '@/internal.js';
import { Root } from '@/root.js';
import { Runtime } from '@/runtime.js';
import { MockBackend } from '../mocks.js';
import { createElement } from '../test-helpers.js';

describe('Root', () => {
  describe('observe()', () => {
    it('registers an observer to the runtime', async () => {
      const value = 'foo';
      const container = document.createElement('div');
      const runtime = new Runtime(new MockBackend());
      const root = Root.create(value, container, runtime);
      const observer = { onRuntimeEvent: vi.fn() };

      const unsubscribe = root.observe(observer);

      await root.mount().finished;

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
      await root.unmount().finished;

      expect(observer.onRuntimeEvent).toHaveBeenCalledTimes(callCount);
    });
  });

  describe('mount()', () => {
    it('mounts a value', async () => {
      const value1 = 'foo';
      const value2 = 'bar';
      const container = document.createElement('div');
      const runtime = new Runtime(new MockBackend());
      const root = Root.create(value1, container, runtime);

      await root.mount().finished;

      expect(container.innerHTML).toBe('<!--foo-->');

      await root.update(value2).finished;

      expect(container.innerHTML).toBe('<!--bar-->');

      await root.unmount().finished;

      expect(container.innerHTML).toBe('');
    });
  });

  describe('hydrate()', () => {
    it('hydrates a value', async () => {
      const value1 = 'foo';
      const value2 = 'bar';
      const container = createElement('div', {}, document.createComment(''));
      const runtime = new Runtime(new MockBackend());
      const root = Root.create(value1, container, runtime);

      await root.hydrate().finished;

      expect(container.innerHTML).toBe('<!--foo-->');

      await root.update(value2).finished;

      expect(container.innerHTML).toBe('<!--bar-->');

      await root.unmount().finished;

      expect(container.innerHTML).toBe('');
    });
  });
});
