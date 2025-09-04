import { describe, expect, it } from 'vitest';

import { CurrentHistory } from '@/extras/router/history.js';
import { TestRenderer } from '../../../test-helpers.js';

describe('CurrentHistory', () => {
  it('should throw an error if the current location is not registered', () => {
    const renderer = new TestRenderer();

    expect(() => {
      renderer.startRender((session) => {
        session.use(CurrentHistory);
      });
    }).toThrow('A context value for the current location does not exist,');
  });
});
