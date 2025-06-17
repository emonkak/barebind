import { describe, expect, it } from 'vitest';
import { createServerRoot } from '../../src/root/server.js';
import { createElement } from '../testUtils.js';

describe('ServerRoot', () => {
  it('mounts the value', () => {
    const value1: string = 'foo';
    const value2: string = 'bar';
    const container = document.createElement('div');
    const root = createServerRoot(value1, container);

    root.mount();

    expect(container.innerHTML).toBe('<!--foo-->');

    root.update(value2);

    expect(container.innerHTML).toBe('<!--bar-->');

    root.unmount();

    expect(container.innerHTML).toBe('');
  });

  it('hydrates the value', async () => {
    const value1: string = 'foo';
    const value2: string = 'bar';
    const container = createElement('div', {}, document.createComment(''));
    const root = createServerRoot(value1, container);

    root.hydrate();

    expect(container.innerHTML).toBe('<!--foo-->');

    root.update(value2);

    expect(container.innerHTML).toBe('<!--bar-->');

    root.unmount();

    expect(container.innerHTML).toBe('');
  });
});
