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
    it.for([[{ foo: true }, 'bar', null, undefined], { foo: true }])(
      'asserts the value is a class specifier',
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

    it.for(['foo', null, undefined])(
      'throws an error if the value is not an array or object',
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
          'The value of ClassListPrimitive must be an array or object,',
        );
      },
    );
  });

  describe('resolveBinding()', () => {
    it.for([':CLASSLIST', ':classlist'])(
      'constructs a new AttributeBinding',
      (attributeName) => {
        const classSpecifier = ['foo', 'bar', 'baz'];
        const part = {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: attributeName,
        };
        const runtime = Runtime.create(new MockBackend());
        const binding = ClassListPrimitive.resolveBinding(
          classSpecifier,
          part,
          runtime,
        );

        expect(binding.type).toBe(ClassListPrimitive);
        expect(binding.value).toBe(classSpecifier);
        expect(binding.part).toBe(part);
      },
    );

    it('throws an error if the part is not a ":classlist" attribute part', () => {
      const classSpecifier = ['foo', 'bar', 'baz'];
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      };
      const runtime = Runtime.create(new MockBackend());

      expect(() =>
        ClassListPrimitive.resolveBinding(classSpecifier, part, runtime),
      ).toThrow(
        'ClassListPrimitive must be used in a ":classlist" attribute part,',
      );
    });
  });
});

describe('ClassListBinding', () => {
  describe('shouldBind()', () => {
    it('returns true if the committed specifier does not exist', () => {
      const classSpecifier = ['foo', 'bar', 'baz'];
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':classlist',
      };
      const binding = new ClassListBinding(classSpecifier, part);

      expect(binding.shouldBind(classSpecifier)).toBe(true);
    });

    it('returns true if any classes are not the same in the class list', () => {
      const classSpecifier = ['foo', { bar: true }, null];
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':classlist',
      };
      const binding = new ClassListBinding(classSpecifier, part);
      const runtime = Runtime.create(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(binding.shouldBind(classSpecifier)).toBe(false);
      expect(binding.shouldBind(structuredClone(classSpecifier))).toBe(false);
      expect(binding.shouldBind(['foo', { bar: true }, undefined])).toBe(false);
      expect(binding.shouldBind(['foo', { bar: true }])).toBe(true);
      expect(binding.shouldBind(['foo', { bar: true }, 'baz'])).toBe(true);
      expect(binding.shouldBind([{ foo: true }, { bar: true }, null])).toBe(
        true,
      );
    });

    it('returns true if any classes are not the same in the class map', () => {
      const classSpecifier = { foo: true, bar: true, baz: false };
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':classlist',
      };
      const binding = new ClassListBinding(classSpecifier, part);
      const runtime = Runtime.create(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(binding.shouldBind(classSpecifier)).toBe(false);
      expect(binding.shouldBind(structuredClone(classSpecifier))).toBe(false);
      expect(binding.shouldBind({ baz: false, bar: true, foo: true })).toBe(
        false,
      );
      expect(binding.shouldBind({ foo: true, bar: true })).toBe(true);
      expect(binding.shouldBind({ foo: true, bar: true, baz: true })).toBe(
        true,
      );
    });
  });

  describe('commit()', () => {
    it('adds only valid class names in the class list', () => {
      const specifier1 = [
        'foo',
        { bar: true, baz: false },
        'qux',
        { corge: true },
      ];
      const specifier2 = [undefined, 'baz', 'quux'];
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':classlist',
      };
      const binding = new ClassListBinding(specifier1, part);
      const runtime = Runtime.create(new MockBackend());

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

    it('adds only valid class names in the class map', () => {
      const specifier1 = { foo: true, bar: true, baz: false };
      const specifier2 = { foo: true, bar: false };
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':classlist',
      };
      const binding = new ClassListBinding(specifier1, part);
      const runtime = Runtime.create(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('foo bar');

      binding.bind(specifier2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('foo');

      binding.bind(specifier1);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('foo bar');
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
      const runtime = Runtime.create(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('foo');

      binding.bind(specifier2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('bar');

      binding.bind(specifier1);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('foo');
    });

    it('can preserve preset class names', () => {
      const specifier = { foo: true, bar: true };
      const part = {
        type: PartType.Attribute,
        node: createElement('div', { class: 'baz' }),
        name: 'class',
      };
      const binding = new ClassListBinding(specifier, part);
      const runtime = Runtime.create(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('baz foo bar');
    });
  });

  describe('rollback()', () => {
    it('removes committed class names', () => {
      const specifier = { foo: true, bar: true, baz: false };
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':classlist',
      };
      const binding = new ClassListBinding(specifier, part);
      const runtime = Runtime.create(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('foo bar');

      binding.disconnect(runtime);
      binding.rollback(runtime);

      expect(part.node.getAttribute('class')).toBe('');
    });
  });
});
