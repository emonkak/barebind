import { describe, expect, it, vi } from 'vitest';

import { Resource } from '@/addons/suspense/resource.js';
import { TestRenderer } from '../../../test-renderer.js';

describe('Resource', () => {
  it('creates a RawResource using the given fetch function', async () => {
    const renderer = new TestRenderer(
      ({ fetchFn }: { fetchFn: () => Promise<string> }, session) => {
        return session.use(Resource(fetchFn));
      },
    );
    const fetchFn = vi.fn(() => Promise.resolve('ok'));

    const suspend = renderer.render({ fetchFn });

    expect(await suspend).toBe('ok');
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(fetchFn).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('returns the same resource instance across renders with same dependencies', async () => {
    const renderer = new TestRenderer(
      ({ fetchFn }: { fetchFn: () => Promise<string> }, session) => {
        return session.use(Resource(fetchFn));
      },
    );
    const fetchFn = vi.fn(() => Promise.resolve('ok'));

    const suspend1 = renderer.render({ fetchFn });
    const suspend2 = renderer.render({ fetchFn });

    expect(suspend1).toBe(suspend2);
    expect(await suspend1).toBe('ok');
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(fetchFn).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('recreates the suspend when dependencies change', async () => {
    const renderer = new TestRenderer(
      (
        {
          fetchFn,
          dependencies,
        }: { fetchFn: () => Promise<string>; dependencies: unknown[] },
        session,
      ) => {
        return session.use(Resource(fetchFn, dependencies));
      },
    );
    const fetchFn = vi
      .fn()
      .mockReturnValueOnce(Promise.resolve('foo'))
      .mockReturnValueOnce(Promise.resolve('bar'));

    const suspend1 = renderer.render({ fetchFn, dependencies: ['foo'] });
    expect(await suspend1).toBe('foo');

    const suspend2 = renderer.render({ fetchFn, dependencies: ['bar'] });
    expect(await suspend2).toBe('bar');

    expect(suspend1).not.toBe(suspend2);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn).toHaveBeenCalledWith(expect.any(AbortSignal));
  });
});
