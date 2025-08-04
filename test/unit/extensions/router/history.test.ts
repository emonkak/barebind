import { describe, expect, it } from 'vitest';
import { Lanes } from '@/core.js';
import { CurrentHistory } from '@/extensions/router/history.js';
import { RenderSession } from '@/render-session.js';
import { Runtime } from '@/runtime.js';
import { MockBackend, MockCoroutine } from '../../../mocks.js';

describe('CurrentHistory', () => {
  it('should throw an error if the current location is not registered', () => {
    const session = new RenderSession(
      [],
      Lanes.AllLanes,
      new MockCoroutine(),
      Runtime.create(new MockBackend()),
    );

    expect(() => session.use(CurrentHistory)).toThrow(
      'A context value for the current location does not exist,',
    );
  });
});
