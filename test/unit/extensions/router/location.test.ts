import { describe, expect, it } from 'vitest';
import { CurrentLocation } from '@/extensions/router/location.js';
import { ALL_LANES } from '@/hook.js';
import { RenderSession } from '@/render-session.js';
import { Runtime } from '@/runtime.js';
import { MockCoroutine, MockHostEnvironment } from '../../../mocks.js';

describe('CurrentLocation', () => {
  it('should throw an error if the current location is not registered', () => {
    const session = new RenderSession(
      [],
      ALL_LANES,
      new MockCoroutine(),
      new Runtime(new MockHostEnvironment()),
    );

    expect(() => session.use(CurrentLocation)).toThrow(
      'A context value for the current location does not exist,',
    );
  });
});
