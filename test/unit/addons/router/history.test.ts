import { describe, expect, it } from 'vitest';

import { HistoryContext } from '@/addons/router/history.js';
import { TestRenderer } from '../../../test-renderer.js';

describe('HistoryContext', () => {
  it('should throw an error if HistoryContext is not registered', () => {
    const renderer = new TestRenderer((_props, session) => {
      session.use(HistoryContext);
    });

    expect(() => {
      renderer.render({});
    }).toThrow('No history context found.');
  });
});
