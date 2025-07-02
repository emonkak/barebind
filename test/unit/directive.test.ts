import { describe, expect, it } from 'vitest';

import {
  $toDirectiveElement,
  createDirectiveObject,
  createSlotObject,
} from '@/directive.js';
import { PartType } from '@/part.js';
import { Runtime } from '@/runtime.js';
import {
  MockDirective,
  MockPrimitive,
  MockRenderHost,
  MockSlot,
} from '../mocks.js';

describe('createDirectiveObject()', () => {
  it('creates a new DirectiveObject', () => {
    const directive = new MockDirective();
    const value = 'foo';
    const part = {
      type: PartType.Text,
      node: document.createTextNode(''),
      precedingText: '',
      followingText: '',
    };
    const runtime = new Runtime(new MockRenderHost());
    const object = createDirectiveObject(directive, value);

    expect(object.directive).toBe(directive);
    expect(object.value).toBe(value);
    expect(object[$toDirectiveElement](part, runtime)).toBe(object);
  });
});

describe('SlotObject', () => {
  it('creates a new SlotObject', () => {
    const value = 'foo';
    const slotType = MockSlot;
    const part = {
      type: PartType.Text,
      node: document.createTextNode(''),
      precedingText: '',
      followingText: '',
    };
    const runtime = new Runtime(new MockRenderHost());
    const object = createSlotObject(value, slotType);
    const element = object[$toDirectiveElement](part, runtime);

    expect(element.directive).toBe(MockPrimitive);
    expect(element.value).toBe(value);
    expect(element.slotType).toBe(slotType);
  });
});
