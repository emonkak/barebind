import { describe, expect, it } from 'vitest';
import { CurrentHistory } from '@/extras/router/history.js';
import { RenderHelper } from '../../../test-helpers.js';

describe('CurrentHistory', () => {
  it('should throw an error if the current location is not registered', () => {
    const helper = new RenderHelper();

    expect(() => {
      helper.startSession((context) => {
        context.use(CurrentHistory);
      });
    }).toThrow('A context value for the current location does not exist,');
  });
});
