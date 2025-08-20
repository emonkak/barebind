import { describe, expect, it, vi } from 'vitest';

import { PartType } from '@/internal.js';
import { AttributeBinding, AttributePrimitive } from '@/primitive/attribute.js';
import { createUpdateSession } from '../../session-utils.js';

describe('AttributePrimitive', () => {
  describe('name', () => {
    it('is a string that represents the primitive itself', () => {
      expect(AttributePrimitive.name, 'AttributePrimitive');
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new AttributeBinding', () => {
      const value = 'foo';
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      };
      const session = createUpdateSession();
      const binding = AttributePrimitive.resolveBinding(value, part, session);

      expect(binding.type).toBe(AttributePrimitive);
      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
    });

    it('should throw the error if the part is not an attribute part', () => {
      const value = 'foo';
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      };
      const session = createUpdateSession();

      expect(() =>
        AttributePrimitive.resolveBinding(value, part, session),
      ).toThrow('AttributePrimitive must be used in an attribute part,');
    });
  });
});

describe('AttributeBinding', () => {
  describe('shouldBind', () => {
    it('returns true if the committed value does not exist', () => {
      const value = 'foo';
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      };
      const binding = new AttributeBinding(value, part);

      expect(binding.shouldBind(value)).toBe(true);
    });

    it('returns true if the committed value is different from the new one', () => {
      const value1 = 'foo';
      const value2 = 'bar';
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      };
      const binding = new AttributeBinding(value1, part);
      const session = createUpdateSession();

      SESSION: {
        binding.connect(session);
        binding.commit(session);

        expect(binding.shouldBind(value1)).toBe(false);
        expect(binding.shouldBind(value2)).toBe(true);
      }
    });
  });

  describe('commit()', () => {
    it.for([null, undefined])(
      'removes the attribute when the value is null or undefined',
      (value2) => {
        const value = 'foo';
        const part = {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: 'class',
        };
        const binding = new AttributeBinding<unknown>(value, part);
        const session = createUpdateSession();

        SESSION1: {
          binding.connect(session);
          binding.commit(session);

          expect(part.node.getAttribute(part.name)).toBe(value);
        }

        SESSION2: {
          binding.bind(value2);
          binding.connect(session);
          binding.commit(session);

          expect(part.node.getAttribute(part.name)).toBe(null);
        }
      },
    );

    it.each([
      ['foo', 'foo'],
      [123, '123'],
      [
        {
          toString(): string {
            return 'foo';
          },
        },
        'foo',
      ],
    ])(
      'sets the attribute with the string representation of the value',
      (value, expectedValue) => {
        const part = {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: 'class',
        };
        const binding = new AttributeBinding(value, part);
        const session = createUpdateSession();

        SESSION: {
          binding.connect(session);
          binding.commit(session);

          expect(part.node.getAttribute(part.name)).toBe(expectedValue);
        }
      },
    );

    it.each([
      [true, ''],
      [false, null],
    ])(
      'toggles the attribute according to the boolean value',
      (value, expectedValue) => {
        const part = {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: 'class',
        };
        const binding = new AttributeBinding(value, part);
        const session = createUpdateSession();

        SESSION: {
          binding.connect(session);
          binding.commit(session);

          expect(part.node.getAttribute(part.name)).toBe(expectedValue);
        }
      },
    );
  });

  describe('rollback()', () => {
    it('removes the committed value from the attribute', () => {
      const value = 'foo';
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      };
      const binding = new AttributeBinding<unknown>(value, part);
      const session = createUpdateSession();

      SESSION1: {
        binding.connect(session);
        binding.commit(session);

        expect(part.node.getAttribute(part.name)).toBe(value);
      }

      SESSION2: {
        binding.disconnect(session);
        binding.rollback(session);

        expect(part.node.getAttribute(part.name)).toBe(null);
      }
    });

    it('should do nothing if the committed value does not exist', () => {
      const value = 'foo';
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      };
      const binding = new AttributeBinding<unknown>(value, part);
      const session = createUpdateSession();

      const removeAttributeSpy = vi.spyOn(part.node, 'removeAttribute');

      SESSION: {
        binding.disconnect(session);
        binding.rollback(session);

        expect(removeAttributeSpy).not.toHaveBeenCalled();
      }
    });
  });
});
