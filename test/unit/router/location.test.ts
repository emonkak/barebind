import { describe, expect, it } from 'vitest';

import { ALL_LANES } from '@/hook.js';
import { RenderSession } from '@/render-session.js';
import { CurrentLocation } from '@/router/location.js';
import { Runtime } from '@/runtime.js';
import { MockCoroutine, MockRenderHost } from '../../mocks.js';

describe('CurrentLocation', () => {
  it('should throw an error if the current location is not registered', () => {
    const session = new RenderSession(
      [],
      ALL_LANES,
      new MockCoroutine(),
      new Runtime(new MockRenderHost()),
    );

    expect(() => session.use(CurrentLocation)).toThrow(
      'A context value for the current location does not exist,',
    );
  });
});
