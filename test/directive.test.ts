import { describe, expect, it } from 'vitest';
import {
  $toDirectiveElement,
  DirectiveObject,
  SlotObject,
} from '../src/directive.js';
import { PartType } from '../src/part.js';
import { UpdateEngine } from '../src/updateEngine.js';
import {
  MockDirective,
  MockPrimitive,
  MockRenderHost,
  MockSlot,
} from './mocks.js';

describe('DirectiveObject', () => {
  describe('[$toDirectiveElement]()', () => {
    it('returns itself as DirectiveElement', () => {
      const directive = new MockDirective();
      const value = 'foo';
      const object = new DirectiveObject(directive, value);

      expect(object.directive).toBe(directive);
      expect(object.value).toBe(value);
      expect(object[$toDirectiveElement]()).toBe(object);
    });
  });
});

describe('SlotObject', () => {
  describe('[$toDirectiveElement]', () => {
    it('returns a new DirectiveElement with the slot type', () => {
      const value = 'foo';
      const slotType = MockSlot;
      const part = {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '',
        followingText: '',
      };
      const context = new UpdateEngine(new MockRenderHost());
      const object = new SlotObject(value, slotType);
      const element = object[$toDirectiveElement](part, context);

      expect(element.directive).toBe(MockPrimitive);
      expect(element.value).toBe(value);
      expect(element.slotType).toBe(slotType);
    });
  });
});
