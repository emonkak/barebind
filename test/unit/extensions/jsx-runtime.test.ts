import { describe, expect, it } from 'vitest';
import { Fragment, jsx, jsxs } from '@/extensions/jsx-runtime.js';
import { VElement, VStaticElement } from '@/extensions/vdom.js';

describe('jsx()', () => {
  it('returns a new VElement', () => {
    const type = 'div';
    const props = { className: 'foo' };
    const element = jsx(type, props);

    expect(element).toBeInstanceOf(VElement);
    expect(element.type).toBe(type);
    expect(element.props).toBe(props);
  });
});

describe('jsxs()', () => {
  it('returns a new VStaticElement', () => {
    const type = 'div';
    const props = { className: 'foo' };
    const element = jsxs(type, props);

    expect(element).toBeInstanceOf(VStaticElement);
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
