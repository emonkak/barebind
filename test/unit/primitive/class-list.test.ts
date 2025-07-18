import { describe, expect, it } from 'vitest';

import { PartType } from '@/core.js';
import {
  ClassListBinding,
  ClassListPrimitive,
  type ClassSpecifier,
} from '@/primitive/class-list.js';
import { Runtime } from '@/runtime.js';
import { MockBackend } from '../../mocks.js';
import { createElement } from '../../test-utils.js';

describe('ClassListPrimitive', () => {
  describe('name', () => {
    it('is a string that represents the primitive itself', () => {
      expect(ClassListPrimitive.name, 'ClassListPrimitive');
    });
  });

  describe('ensureValue()', () => {
    it.each([[[]], [[{ foo: true }]], [['foo']], [[null]], [[undefined]]])(
      'asserts the value is an array of class specifier',
      (value) => {
        const part = {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: ':classlist',
        };
        const ensureValue: NonNullable<typeof ClassListPrimitive.ensureValue> =
          ClassListPrimitive.ensureValue!;

        expect(() => {
          ensureValue.call(ClassListPrimitive, value, part);
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
          ensureValue.call(ClassListPrimitive, value, part);
        }).toThrow(
          'The value of ClassListPrimitive must be an array of class specifier,',
        );
      },
    );
  });

  describe('resolveBinding()', () => {
    it.each([[':CLASSLIST'], [':classlist']])(
      'constructs a new AttributeBinding',
      (attributeName) => {
        const specifier = ['foo', 'bar', 'baz'];
        const part = {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: attributeName,
        };
        const runtime = new Runtime(new MockBackend());
        const binding = ClassListPrimitive.resolveBinding(
          specifier,
          part,
          runtime,
        );

        expect(binding.type).toBe(ClassListPrimitive);
        expect(binding.value).toBe(specifier);
        expect(binding.part).toBe(part);
      },
    );

    it('throws an error if the part is not a ":classlist" attribute part', () => {
      const specifier = ['foo', 'bar', 'baz'];
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      };
      const runtime = new Runtime(new MockBackend());

      expect(() =>
        ClassListPrimitive.resolveBinding(specifier, part, runtime),
      ).toThrow(
        'ClassListPrimitive must be used in a ":classlist" attribute part,',
      );
    });
  });
});

describe('ClassListBinding', () => {
  describe('shouldBind()', () => {
    it('returns true if the committed specifier does not exist', () => {
      const specifier = ['foo', 'bar', 'baz'];
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':classlist',
      };
      const binding = new ClassListBinding(specifier, part);

      expect(binding.shouldBind(specifier)).toBe(true);
    });

    it('returns true if any class are not the same as the committed one', () => {
      const specifier = ['foo', { bar: true }, null];
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':classlist',
      };
      const binding = new ClassListBinding(specifier, part);
      const runtime = new Runtime(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(binding.shouldBind(specifier)).toBe(false);
      expect(binding.shouldBind(structuredClone(specifier))).toBe(false);
      expect(binding.shouldBind(['foo', { bar: true }, undefined])).toBe(false);
      expect(binding.shouldBind(['foo', { bar: true }])).toBe(true);
      expect(binding.shouldBind(['foo', { bar: true }, 'baz'])).toBe(true);
      expect(binding.shouldBind([{ foo: true }, { bar: true }, null])).toBe(
        true,
      );
    });
  });

  describe('commit()', () => {
    it('adds only valid class names', () => {
      const specifier1 = [
        'foo',
        { bar: true, baz: false },
        'qux',
        { corge: true },
      ];
      const specifier2 = [undefined, { baz: true }, 'quux'];
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':classlist',
      };
      const binding = new ClassListBinding(specifier1, part);
      const runtime = new Runtime(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('foo bar qux corge');

      binding.bind(specifier2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('baz quux');

      binding.bind(specifier1);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('foo bar qux corge');
    });

    it('adds duplicated classs names correctly', () => {
      const specifier1 = [{ foo: true, bar: false }, 'foo'];
      const specifier2 = [{ foo: false, bar: true }, 'foo'];
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':classlist',
      };
      const binding = new ClassListBinding(specifier1, part);
      const runtime = new Runtime(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('foo');

      binding.bind(specifier2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('bar foo');

      binding.bind(specifier1);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('foo');
    });

    it('should preserve preset class names', () => {
      const specifier = ['foo', 'bar'];
      const part = {
        type: PartType.Attribute,
        node: createElement('div', { class: 'baz' }),
        name: 'class',
      };
      const binding = new ClassListBinding(specifier, part);
      const runtime = new Runtime(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('baz foo bar');
    });

    it('should remove preset class names if it is overwritten', () => {
      const specifier1 = ['foo', 'bar'];
      const specifier2: ClassSpecifier[] = [];
      const part = {
        type: PartType.Attribute,
        node: createElement('div', { class: 'foo bar baz' }),
        name: 'class',
      };
      const binding = new ClassListBinding(specifier1, part);
      const runtime = new Runtime(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('foo bar baz');

      binding.bind(specifier2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('baz');
    });
  });

  describe('rollback()', () => {
    it('removes committed class names', () => {
      const specifier = ['foo', 'bar', null];
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':classlist',
      };
      const binding = new ClassListBinding(specifier, part);
      const runtime = new Runtime(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('foo bar');

      binding.disconnect(runtime);
      binding.rollback(runtime);

      expect(part.node.getAttribute('class')).toBe('');
    });
  });
});
