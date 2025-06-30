import { describe, expect, it } from 'vitest';
import { ALL_LANES } from '@/hook.js';
import { RenderEngine } from '@/renderEngine.js';
import { BrowserRenderHost } from '@/renderHost/browser.js';
import { CurrentLocation } from '@/router/location.js';
import { UpdateEngine } from '@/updateEngine.js';
import { MockCoroutine } from '../../mocks.js';

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
