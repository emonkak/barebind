import { describe, expect, it } from 'vitest';
import { Lanes } from '@/core.js';
import { CurrentLocation } from '@/extensions/router/location.js';
import { RenderSession } from '@/render-session.js';
import { Runtime } from '@/runtime.js';
import { MockBackend, MockCoroutine } from '../../../mocks.js';

describe('CurrentLocation', () => {
  it('should throw an error if the current location is not registered', () => {
    const session = new RenderSession(
      [],
      Lanes.AllLanes,
      new MockCoroutine(),
      new Runtime(new MockBackend()),
    );

    expect(() => session.use(CurrentLocation)).toThrow(
      'A context value for the current location does not exist,',
    );
  });
});
