import { describe, expect, it } from 'vitest';
import { CurrentHistory } from '@/extras/router/history.js';
import { createSession } from '../../../session-utils.js';

describe('CurrentHistory', () => {
  it('should throw an error if the current location is not registered', () => {
    const session = createSession();

    expect(() => session.use(CurrentHistory)).toThrow(
      'A context value for the current location does not exist,',
    );
  });
});
