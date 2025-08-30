import { describe, expect, it } from 'vitest';

import { Fragment, jsx, jsxs } from '@/extras/jsx-runtime.js';
import { VElement, VFragment, VStaticFragment } from '@/extras/vdom.js';

describe('jsx()', () => {
  it('returns a new VElement', () => {
    const type = 'div';
    const props = { className: 'foo' };
    const element = jsx(type, props);

    expect(element).toBeInstanceOf(VElement);
    expect(element).toStrictEqual(
      expect.objectContaining({
        type,
        props,
        hasStaticChildren: false,
      }),
    );
  });

  it('returns a new VFragment', () => {
    const props = { children: ['foo', 'bar'] };
    const element = jsx(Fragment, props);

    expect(element).toBeInstanceOf(VFragment);
    expect(element).toStrictEqual(
      expect.objectContaining({
        children: props.children,
      }),
    );
  });
});

describe('jsxs()', () => {
  it('returns a new VElement with static children', () => {
    const type = 'div';
    const props = { className: 'foo' };
    const element = jsxs(type, props);

    expect(element).toBeInstanceOf(VElement);
    expect(element).toStrictEqual(
      expect.objectContaining({
        type,
        props,
        hasStaticChildren: true,
      }),
    );
  });

  it('returns a new VStaticFragment', () => {
    const props = { children: ['foo', 'bar'] };
    const element = jsxs(Fragment, props);

    expect(element).toBeInstanceOf(VStaticFragment);
    expect(element).toStrictEqual(
      expect.objectContaining({
        children: props.children,
      }),
    );
  });
});
