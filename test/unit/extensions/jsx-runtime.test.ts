import { describe, expect, it } from 'vitest';
import { Fragment, jsx } from '@/extensions/jsx-runtime.js';

describe('jsx()', () => {
  it('returns a new VElement', () => {
    const type = 'div';
    const props = { className: 'foo' };
    const element = jsx(type, props);

    expect(element.type).toBe(type);
    expect(element.props).toBe(props);
  });
});

describe('Fragment()', () => {
  it('returns a new VFragment with the children', () => {
    const props = { children: [] };
    const fragment = Fragment(props);

    expect(fragment.children).toBe(props.children);
  });
});
