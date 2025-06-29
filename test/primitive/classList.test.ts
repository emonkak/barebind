import { describe, expect, it } from 'vitest';

import { PartType } from '../../src/part.js';
import {
  ClassListBinding,
  ClassListPrimitive,
  type ClassName,
} from '../../src/primitive/classList.js';
import { UpdateEngine } from '../../src/updateEngine.js';
import { MockRenderHost } from '../mocks.js';
import { createElement } from '../testUtils.js';

describe('ClassListPrimitive', () => {
  describe('name', () => {
    it('is a string that represents the primitive itself', () => {
      expect(ClassListPrimitive.name, 'ClassListPrimitive');
    });
  });

  describe('ensureValue()', () => {
    it.each([[[]], [[{ foo: true }]], [['foo']], [[null]], [[undefined]]])(
      'asserts the value is an array of class name',
      (value) => {
        const part = {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: ':classlist',
        } as const;
        const ensureValue: (typeof ClassListPrimitive)['ensureValue'] =
          ClassListPrimitive.ensureValue;

        expect(() => {
          ensureValue(value, part);
        }).not.toThrow();
      },
    );

    it.each([[[123]], [{}], ['foo'], [null], [undefined]])(
      'throws the error if the value is not an array',
      (value) => {
        const part = {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: ':classlist',
        } as const;
        const ensureValue: (typeof ClassListPrimitive)['ensureValue'] =
          ClassListPrimitive.ensureValue;

        expect(() => {
          ensureValue(value, part);
        }).toThrow(
          'The value of ClassListPrimitive must be array of class name,',
        );
      },
    );
  });

  describe('resolveBinding()', () => {
    it.each([[':CLASSLIST'], [':classlist']])(
      'constructs a new AttributeBinding',
      (attributeName) => {
        const classNames = ['foo', 'bar', 'baz'];
        const part = {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: attributeName,
        } as const;
        const context = new UpdateEngine(new MockRenderHost());
        const binding = ClassListPrimitive.resolveBinding(
          classNames,
          part,
          context,
        );

        expect(binding.directive).toBe(ClassListPrimitive);
        expect(binding.value).toBe(classNames);
        expect(binding.part).toBe(part);
      },
    );

    it('throws the error if the part is not a ":classlist" attribute part', () => {
      const classNames = ['foo', 'bar', 'baz'];
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      } as const;
      const context = new UpdateEngine(new MockRenderHost());

      expect(() =>
        ClassListPrimitive.resolveBinding(classNames, part, context),
      ).toThrow(
        'ClassListPrimitive must be used in a ":classlist" attribute part,',
      );
    });
  });
});

describe('ClassListBinding', () => {
  describe('shouldBind()', () => {
    it('returns true if the committed classNames does not exist', () => {
      const classNames = ['foo', 'bar', 'baz'];
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':classlist',
      } as const;
      const binding = new ClassListBinding(classNames, part);

      expect(binding.shouldBind(classNames)).toBe(true);
    });

    it('returns true if any class are not the same as the committed one', () => {
      const classNames1 = ['foo', 'bar', 'baz'];
      const classNames2 = ['qux', 'quux'];
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':classlist',
      } as const;
      const binding = new ClassListBinding(classNames1, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit(context);

      expect(binding.shouldBind([...classNames1])).toBe(false);
      expect(binding.shouldBind(classNames2)).toBe(true);
    });
  });

  describe('commit()', () => {
    it('adds only valid class names', () => {
      const classNames1 = [
        'foo',
        { bar: true, baz: false },
        'qux',
        { corge: true },
      ];
      const classNames2 = [undefined, { baz: true }, 'quux'];
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':classlist',
      } as const;
      const binding = new ClassListBinding(classNames1, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit(context);

      expect(part.node.getAttribute('class')).toBe('foo bar qux corge');

      binding.bind(classNames2);
      binding.connect(context);
      binding.commit(context);

      expect(part.node.getAttribute('class')).toBe('baz quux');

      binding.bind(classNames1);
      binding.connect(context);
      binding.commit(context);

      expect(part.node.getAttribute('class')).toBe('foo bar qux corge');
    });

    it('adds duplicated classs names correctly', () => {
      const classNames1 = [{ foo: true, bar: false }, 'foo'];
      const classNames2 = [{ foo: false, bar: true }, 'foo'];
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':classlist',
      } as const;
      const binding = new ClassListBinding(classNames1, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit(context);

      expect(part.node.getAttribute('class')).toBe('foo');

      binding.bind(classNames2);
      binding.connect(context);
      binding.commit(context);

      expect(part.node.getAttribute('class')).toBe('bar foo');

      binding.bind(classNames1);
      binding.connect(context);
      binding.commit(context);

      expect(part.node.getAttribute('class')).toBe('foo');
    });

    it('should preserve preset class names', () => {
      const classNames = ['foo', 'bar'];
      const part = {
        type: PartType.Attribute,
        node: createElement('div', { class: 'baz' }),
        name: 'class',
      } as const;
      const binding = new ClassListBinding(classNames, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit(context);

      expect(part.node.getAttribute('class')).toBe('baz foo bar');
    });

    it('should remove preset class names if it is overwritten', () => {
      const classNames1 = ['foo', 'bar'];
      const classNames2: ClassName[] = [];
      const part = {
        type: PartType.Attribute,
        node: createElement('div', { class: 'foo bar baz' }),
        name: 'class',
      } as const;
      const binding = new ClassListBinding(classNames1, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit(context);

      expect(part.node.getAttribute('class')).toBe('foo bar baz');

      binding.bind(classNames2);
      binding.connect(context);
      binding.commit(context);

      expect(part.node.getAttribute('class')).toBe('baz');
    });
  });

  describe('rollback()', () => {
    it('removes committed class names', () => {
      const classNames = ['foo', 'bar', null];
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':classlist',
      } as const;
      const binding = new ClassListBinding(classNames, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit(context);

      expect(part.node.getAttribute('class')).toBe('foo bar');

      binding.disconnect(context);
      binding.rollback(context);

      expect(part.node.getAttribute('class')).toBe('');
    });
  });
});
