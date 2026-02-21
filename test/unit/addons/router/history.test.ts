import { describe, expect, it } from 'vitest';

import { CurrentHistory } from '@/addons/router/history.js';
import { TestRenderer } from '../../../test-renderer.js';

describe('CurrentHistory', () => {
  it('should throw an error if the current location is not registered', () => {
    const renderer = new TestRenderer((_props, session) => {
      session.use(CurrentHistory);
    });

    expect(() => {
      renderer.render({});
    }).toThrow('No history context found.');
  });
});
