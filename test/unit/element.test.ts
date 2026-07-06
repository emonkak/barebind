import { describe, expect, it } from 'vitest';
import { Bind, Fragment } from '@/core.js';
import { html, math, Partial, svg, text } from '@/element.js';

describe('html()', () => {
  it('creates a VTemplate with "html" mode', () => {
    const t = html`<div>hello</div>`;
    expect(t.type).toStrictEqual(['<div>hello</div>']);
    expect(t.props.mode).toBe('html');
    expect(t.children).toHaveLength(0);
  });

  it('creates nested template children for interpolated values', () => {
    const t = html`<div>${html`<span>${'x'}</span>`}</div>`;
    expect(t.children).toHaveLength(1);
    const child = t.children[0]!;
    expect(child.type).toStrictEqual(['<span>', '</span>']);
    expect(child.props.mode).toBe('html');
    expect(child.children).toHaveLength(1);
    expect(child.children[0]!.props.value).toBe('x');
  });

  it('creates bind children for interpolated values', () => {
    const t = html`<div>${'x'}</div>`;
    expect(t.children).toHaveLength(1);
    const child = t.children[0]!;
    expect(child.type).toBe(Bind);
    expect(child.props.value).toBe('x');
  });

  it('preserves array values as fragment children', () => {
    const t = html`<ul>${['a', 'b']}</ul>`;
    expect(t.children).toHaveLength(1);
    const child = t.children[0]!;
    expect(child.type).toBe(Fragment);
    expect(child.children).toHaveLength(2);
    expect(child.children[0]!.props.value).toBe('a');
    expect(child.children[1]!.props.value).toBe('b');
  });

  it('preserves null/undefined as bind children', () => {
    const t = html`<div>${null}${undefined}</div>`;
    expect(t.children).toHaveLength(2);
    expect(t.children[0]!.props.value).toBe(null);
    expect(t.children[1]!.props.value).toBe(undefined);
  });

  it('interleaves strings and values correctly', () => {
    const t = html`<div>${'a'}</div>`;
    expect(t.type).toStrictEqual(['<div>', '</div>']);
  });

  it('handles multiple interpolations', () => {
    const t = html`<div>${1}${2}${3}</div>`;
    expect(t.children).toHaveLength(3);
    expect(t.children[0]!.props.value).toBe(1);
    expect(t.children[1]!.props.value).toBe(2);
    expect(t.children[2]!.props.value).toBe(3);
  });
});

describe('math()', () => {
  it('creates a VTemplate with "math" mode', () => {
    const t = math`<msqrt>${'x'}</msqrt>`;
    expect(t.props.mode).toBe('math');
  });
});

describe('svg()', () => {
  it('creates a VTemplate with "svg" mode', () => {
    const t = svg`<circle cx="${50}" r="${10}" />`;
    expect(t.props.mode).toBe('svg');
  });
});

describe('text()', () => {
  it('creates a VTemplate with "textarea" mode', () => {
    const t = text`hello ${'world'}`;
    expect(t.props.mode).toBe('textarea');
  });
});

describe('Partial.parse()', () => {
  it('returns a Partial with given strings and values when no nested Partials', () => {
    const p = Partial.parse`<div>${'hello'}</div>`;
    expect(p.strings).toStrictEqual(['<div>', '</div>']);
    expect(p.values).toStrictEqual(['hello']);
  });

  it('flattens a single nested Partial', () => {
    const inner = Partial.parse`<span>${'x'}</span>`;
    const outer = Partial.parse`<div>${inner}</div>`;
    expect(outer.strings).toStrictEqual(['<div><span>', '</span></div>']);
    expect(outer.values).toStrictEqual(['x']);
  });

  it('flattens multiple nested Partials', () => {
    const a = Partial.parse`<i>${'x'}</i>`;
    const b = Partial.parse`<b>${'y'}</b>`;
    const outer = Partial.parse`<p>${a} & ${b}</p>`;
    expect(outer.strings).toStrictEqual(['<p><i>', '</i> & <b>', '</b></p>']);
    expect(outer.values).toStrictEqual(['x', 'y']);
  });

  it('flattens mix of Partials and plain values', () => {
    const inner = Partial.parse`<span>${'x'}</span>`;
    const outer = Partial.parse`<div>${inner} text ${42}</div>`;
    expect(outer.strings).toStrictEqual([
      '<div><span>',
      '</span> text ',
      '</div>',
    ]);
    expect(outer.values).toStrictEqual(['x', 42]);
  });

  it('uses Partial.literal() as a raw text fragment', () => {
    const lit = Partial.literal(' &amp; ');
    const outer = Partial.parse`<div>${lit}</div>`;
    expect(outer.strings).toStrictEqual(['<div> &amp; </div>']);
    expect(outer.values).toStrictEqual([]);
  });

  it('returns equivalent interpolatedStrings for repeated calls with same structure', () => {
    const inner1 = Partial.parse`<span>${'a'}</span>`;
    const inner2 = Partial.parse`<span>${'b'}</span>`;
    const outer1 = Partial.parse`<div>${inner1}</div>`;
    const outer2 = Partial.parse`<div>${inner2}</div>`;
    expect(outer1.strings).toStrictEqual(outer2.strings);
    expect(outer1.values).toStrictEqual(['a']);
    expect(outer2.values).toStrictEqual(['b']);
  });

  it('caches interpolatedStrings when the same strings reference is reused', () => {
    const outerStrings = ['<div>', '</div>'];
    const inner1 = Partial.parse`<span>${'a'}</span>`;
    const inner2 = Partial.parse`<span>${'b'}</span>`;
    const outer1 = Partial.parse(outerStrings, inner1);
    const outer2 = Partial.parse(outerStrings, inner2);
    expect(outer1.strings).toBe(outer2.strings);
  });

  it('produces different interpolatedStrings for different nested structures', () => {
    const innerA = Partial.parse`<span>${'x'}</span>`;
    const innerB = Partial.parse`<b>${'y'}</b>`;
    const outerA = Partial.parse`<div>${innerA}</div>`;
    const outerB = Partial.parse`<div>${innerB}</div>`;
    expect(outerA.strings).not.toBe(outerB.strings);
    expect(outerA.strings).toStrictEqual(['<div><span>', '</span></div>']);
    expect(outerB.strings).toStrictEqual(['<div><b>', '</b></div>']);
  });

  it('handles deeply nested Partials', () => {
    const inner = Partial.parse`<span>${'x'}</span>`;
    const mid = Partial.parse`<div>${inner}</div>`;
    const outer = Partial.parse`<section>${mid}</section>`;
    expect(outer.strings).toStrictEqual([
      '<section><div><span>',
      '</span></div></section>',
    ]);
    expect(outer.values).toStrictEqual(['x']);
  });

  it('handles empty string templates', () => {
    const p = Partial.parse``;
    expect(p.strings).toStrictEqual(['']);
    expect(p.values).toStrictEqual([]);
  });
});

describe('Partial.html()', () => {
  it('creates a VTemplate with "html" mode', () => {
    const inner = Partial.parse`<span>${'x'}</span>`;
    const t = Partial.html`<div>${inner}</div>`;
    expect(t.props.mode).toBe('html');
  });
});

describe('Partial.math()', () => {
  it('creates a VTemplate with "math" mode', () => {
    const t = Partial.math`<msqrt>${'x'}</msqrt>`;
    expect(t.props.mode).toBe('math');
  });
});

describe('Partial.svg()', () => {
  it('creates a VTemplate with "svg" mode', () => {
    const t = Partial.svg`<circle cx="${50}" />`;
    expect(t.props.mode).toBe('svg');
  });
});

describe('Partial.literal()', () => {
  it('creates a Partial with a single string and no values', () => {
    const p = Partial.literal('plain text');
    expect(p.strings).toStrictEqual(['plain text']);
    expect(p.values).toStrictEqual([]);
  });
});

describe('Partial.toString()', () => {
  it('reconstructs the template string with values', () => {
    const p = Partial.parse`<div>${'hello'}</div>`;
    expect(p.toString()).toBe('<div>hello</div>');
  });

  it('stringifies non-string values', () => {
    const p = Partial.parse`value=${42}`;
    expect(p.toString()).toBe('value=42');
  });

  it('joins strings with no values', () => {
    const p = Partial.parse`just text`;
    expect(p.toString()).toBe('just text');
  });
});
