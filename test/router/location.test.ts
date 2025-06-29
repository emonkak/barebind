import { describe, expect, it } from 'vitest';
import { ALL_LANES } from '../../src/hook.js';
import { RenderEngine } from '../../src/renderEngine.js';
import { BrowserRenderHost } from '../../src/renderHost/browser.js';
import { CurrentLocation } from '../../src/router/location.js';
import { UpdateEngine } from '../../src/updateEngine.js';
import { MockCoroutine } from '../mocks.js';

describe('CurrentLocation', () => {
  it('should throw an error if the current location is not registered', () => {
    const context = new RenderEngine(
      [],
      ALL_LANES,
      new MockCoroutine(),
      new UpdateEngine(new BrowserRenderHost()),
    );

    expect(() => context.use(CurrentLocation)).toThrow(
      'A context value for the current location does not exist,',
    );
  });
});
