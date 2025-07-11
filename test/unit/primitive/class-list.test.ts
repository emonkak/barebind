import { describe, expect, it } from 'vitest';

import { PartType } from '@/part.js';
import {
  ClassListBinding,
  ClassListPrimitive,
  type ClassName,
} from '@/primitive/class-list.js';
import { Runtime } from '@/runtime.js';
import { MockRenderHost } from '../../mocks.js';
import { createElement } from '../../test-utils.js';

describe('ClassListPrimitive', () => {
  describe('displayName', () => {
    it('is a string that represents the primitive itself', () => {
      expect(ClassListPrimitive.displayName, 'ClassListPrimitive');
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
        };
        const ensureValue: NonNullable<typeof ClassListPrimitive.ensureValue> =
          ClassListPrimitive.ensureValue!;

        expect(() => {
          ensureValue(value, part);
        }).not.toThrow();
      },
    );

    it.each([[[123]], [{}], ['foo'], [null], [undefined]])(
      'throws an error if the value is not an array',
      (value) => {
        const part = {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: ':classlist',
        };
        const ensureValue: NonNullable<typeof ClassListPrimitive.ensureValue> =
          ClassListPrimitive.ensureValue!;

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
        };
        const runtime = new Runtime(new MockRenderHost());
        const binding = ClassListPrimitive.resolveBinding(
          classNames,
          part,
          runtime,
        );

        expect(binding.type).toBe(ClassListPrimitive);
        expect(binding.value).toBe(classNames);
        expect(binding.part).toBe(part);
      },
    );

    it('throws an error if the part is not a ":classlist" attribute part', () => {
      const classNames = ['foo', 'bar', 'baz'];
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      };
      const runtime = new Runtime(new MockRenderHost());

      expect(() =>
        ClassListPrimitive.resolveBinding(classNames, part, runtime),
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
      };
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
      };
      const binding = new ClassListBinding(classNames1, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

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
      };
      const binding = new ClassListBinding(classNames1, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('foo bar qux corge');

      binding.bind(classNames2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('baz quux');

      binding.bind(classNames1);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('foo bar qux corge');
    });

    it('adds duplicated classs names correctly', () => {
      const classNames1 = [{ foo: true, bar: false }, 'foo'];
      const classNames2 = [{ foo: false, bar: true }, 'foo'];
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':classlist',
      };
      const binding = new ClassListBinding(classNames1, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('foo');

      binding.bind(classNames2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('bar foo');

      binding.bind(classNames1);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('foo');
    });

    it('should preserve preset class names', () => {
      const classNames = ['foo', 'bar'];
      const part = {
        type: PartType.Attribute,
        node: createElement('div', { class: 'baz' }),
        name: 'class',
      };
      const binding = new ClassListBinding(classNames, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('baz foo bar');
    });

    it('should remove preset class names if it is overwritten', () => {
      const classNames1 = ['foo', 'bar'];
      const classNames2: ClassName[] = [];
      const part = {
        type: PartType.Attribute,
        node: createElement('div', { class: 'foo bar baz' }),
        name: 'class',
      };
      const binding = new ClassListBinding(classNames1, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('foo bar baz');

      binding.bind(classNames2);
      binding.connect(runtime);
      binding.commit(runtime);

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
      };
      const binding = new ClassListBinding(classNames, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('foo bar');

      binding.disconnect(runtime);
      binding.rollback(runtime);

      expect(part.node.getAttribute('class')).toBe('');
    });
  });
});
