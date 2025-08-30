import { describe, expect, it } from 'vitest';

import { Root } from '@/root.js';
import { Runtime } from '@/runtime.js';
import { MockBackend } from '../mocks.js';
import { createElement } from '../test-helpers.js';

describe('Root', () => {
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
