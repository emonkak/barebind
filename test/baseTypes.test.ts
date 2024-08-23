import { describe, expect, it, vi } from 'vitest';

import {
  PartType,
  directiveTag,
  isDirective,
  nameOf,
  nameTag,
  resolveBinding,
} from '../src/baseTypes.js';
import {
  MockBlock,
  MockUpdateHost,
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

describe('nameOf()', () => {
  it('should return the name of the value', () => {
    expect(nameOf(null)).toBe('null');
    expect(nameOf(undefined)).toBe('undefined');
    expect(nameOf('foo')).toBe('"foo"');
    expect(nameOf(123)).toBe('123');
    expect(nameOf(true)).toBe('true');
    expect(nameOf({})).toBe('Object');
    expect(nameOf(new Date())).toBe('Date');
    expect(nameOf(() => {})).toBe('Function');
    expect(nameOf(function foo() {})).toBe('foo');
    expect(nameOf({ [nameTag]: 'foo' })).toBe('foo');
  });
});

describe('resolveBinding()', () => {
  it('should perform a directive', () => {
    const host = new MockUpdateHost();
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
    const host = new MockUpdateHost();
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
