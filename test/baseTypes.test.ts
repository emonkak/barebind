import { describe, expect, it, vi } from 'vitest';

import {
  PartType,
  directiveTag,
  isDirective,
  resolveBinding,
} from '../src/baseTypes.js';
import {
  MockBlock,
  MockRenderHost,
  TextBinding,
  TextDirective,
} from './mocks.js';

describe('isDirective()', () => {
  it('should return true if the value is directive', () => {
    expect(isDirective(null)).toBe(false);
    expect(isDirective(undefined)).toBe(false);
    expect(isDirective('foo')).toBe(false);
    expect(isDirective(123)).toBe(false);
    expect(isDirective(true)).toBe(false);
    expect(isDirective({})).toBe(false);
    expect(isDirective(() => {})).toBe(false);
    expect(isDirective({ [directiveTag]: () => {} })).toBe(true);
  });
});

describe('resolveBinding()', () => {
  it('should perform a directive', () => {
    const host = new MockRenderHost();
    const block = new MockBlock();

    const value = new TextDirective();
    const part = {
      type: PartType.Node,
      node: document.createTextNode(''),
    } as const;

    const binding = resolveBinding(value, part, { host, block });

    expect(binding).toBeInstanceOf(TextBinding);
    expect(binding.value).toBe(value);
    expect(binding.part).toBe(part);
  });

  it('should resolve a non-directive value by the update host', () => {
    const host = new MockRenderHost();
    const block = new MockBlock();

    const value = 'foo';
    const part = {
      type: PartType.Node,
      node: document.createTextNode(''),
    } as const;
    const binding = new TextBinding(new TextDirective(value), part);

    const resolveBindingSpy = vi
      .spyOn(host, 'resolveBinding')
      .mockReturnValue(binding);

    expect(resolveBinding(value, part, { host, block })).toBe(binding);
    expect(resolveBindingSpy).toHaveBeenCalledOnce();
    expect(resolveBindingSpy).toHaveBeenCalledWith(value, part);
  });
});
