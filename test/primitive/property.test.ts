import { describe, expect, it, vi } from 'vitest';

import { PartType } from '../../src/part.js';
import {
  PropertyBinding,
  PropertyPrimitive,
} from '../../src/primitive/property.js';
import { UpdateEngine } from '../../src/updateEngine.js';
import { MockRenderHost } from '../mocks.js';

describe('PropertyPrimitive', () => {
  describe('name', () => {
    it('is a string that represents the primitive itself', () => {
      expect(PropertyPrimitive.name, 'PropertyPrimitive');
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new PropertyBinding', () => {
      const value = '<div>foo</div>';
      const part = {
        type: PartType.Property,
        node: document.createElement('div'),
        name: 'innerHTML',
        defaultValue: '',
      } as const;
      const context = new UpdateEngine(new MockRenderHost());
      const binding = PropertyPrimitive.resolveBinding(value, part, context);

      expect(binding.directive).toBe(PropertyPrimitive);
      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
    });

    it('should throw the error if the part is not a property part', () => {
      const value = '<div>foo</div>';
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const context = new UpdateEngine(new MockRenderHost());

      expect(() =>
        PropertyPrimitive.resolveBinding(value, part, context),
      ).toThrow('PropertyPrimitive must be used in a property part,');
    });
  });
});

describe('PropertyBinding', () => {
  describe('shouldBind()', () => {
    it('returns true if the committed value does not exist', () => {
      const value = '<div>foo</div>';
      const part = {
        type: PartType.Property,
        node: document.createElement('div'),
        name: 'innerHTML',
        defaultValue: '',
      } as const;
      const binding = new PropertyBinding(value, part);

      expect(binding.shouldBind(value)).toBe(true);
    });

    it('returns true if the committed value is different from the new one', () => {
      const value1 = '<div>foo</div>';
      const value2 = '<div>bar</div>';
      const part = {
        type: PartType.Property,
        node: document.createElement('div'),
        name: 'innerHTML',
        defaultValue: '',
      } as const;
      const binding = new PropertyBinding(value1, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit(context);

      expect(binding.shouldBind(value1)).toBe(false);
      expect(binding.shouldBind(value2)).toBe(true);
    });
  });

  describe('commit()', () => {
    it('sets the value for the property', () => {
      const value1 = '<div>foo</div>';
      const value2 = '<div>foo</div>';
      const part = {
        type: PartType.Property,
        node: document.createElement('div'),
        name: 'innerHTML',
        defaultValue: '',
      } as const;
      const binding = new PropertyBinding(value1, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit(context);

      expect(part.node.innerHTML).toBe(value1);

      binding.bind(value2);
      binding.connect(context);
      binding.commit(context);

      expect(part.node.innerHTML).toBe(value2);
    });
  });

  describe('rollback()', () => {
    it('restores the property to the initial value of the part', () => {
      const value = '<div>foo</div>';
      const part = {
        type: PartType.Property,
        node: document.createElement('div'),
        name: 'innerHTML',
        defaultValue: '',
      } as const;
      const binding = new PropertyBinding(value, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit(context);

      binding.disconnect(context);
      binding.rollback(context);

      expect(part.node.innerHTML).toBe('');
    });

    it('should do nothing if the committed value does not exist', () => {
      const value = '<div>foo</div>';
      const part = {
        type: PartType.Property,
        node: document.createElement('div'),
        name: 'innerHTML',
        defaultValue: '',
      } as const;
      const binding = new PropertyBinding(value, part);
      const context = new UpdateEngine(new MockRenderHost());

      const setInnerHTMLSpy = vi.spyOn(part.node, 'innerHTML', 'set');

      binding.disconnect(context);
      binding.rollback(context);

      expect(setInnerHTMLSpy).not.toHaveBeenCalled();
    });
  });
});
