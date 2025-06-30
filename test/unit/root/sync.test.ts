import { describe, expect, it } from 'vitest';
import { createSyncRoot } from '@/root/sync.js';
import { MockRenderHost } from '../../mocks.js';
import { createElement } from '../../testUtils.js';

describe('SyncRoot', () => {
  it('mounts the value', () => {
    const value1: string = 'foo';
    const value2: string = 'bar';
    const container = document.createElement('div');
    const renderHost = new MockRenderHost();
    const root = createSyncRoot(value1, container, renderHost);

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
    const renderHost = new MockRenderHost();
    const root = createSyncRoot(value1, container, renderHost);

    root.hydrate();

    expect(container.innerHTML).toBe('<!--foo-->');

    root.update(value2);

    expect(container.innerHTML).toBe('<!--bar-->');

    root.unmount();

    expect(container.innerHTML).toBe('');
  });
});
