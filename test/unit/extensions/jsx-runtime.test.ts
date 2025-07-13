import { describe, expect, it } from 'vitest';
import { Fragment, jsx, jsxs } from '@/extensions/jsx-runtime.js';
import { VElement } from '@/extensions/vdom.js';

describe('jsx()', () => {
  it('returns a new VElement', () => {
    const type = 'div';
    const props = { className: 'foo' };
    const element = jsx(type, props);

    expect(element).toBeInstanceOf(VElement);
    expect(element.type).toBe(type);
    expect(element.props).toBe(props);
    expect(element.hasStaticChildren).toBe(false);
  });
});

describe('jsxs()', () => {
  it('returns a new VElement with static children', () => {
    const type = 'div';
    const props = { className: 'foo' };
    const element = jsxs(type, props);

    expect(element).toBeInstanceOf(VElement);
    expect(element.type).toBe(type);
    expect(element.props).toBe(props);
    expect(element.hasStaticChildren).toBe(true);
  });
});

describe('Fragment()', () => {
  it('returns a new VFragment with the children', () => {
    const props = { children: [] };
    const fragment = Fragment(props);

    expect(fragment.children).toBe(props.children);
  });
});
