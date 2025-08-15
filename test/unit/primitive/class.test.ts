import { describe, expect, it } from 'vitest';

import { PartType } from '@/core.js';
import { ClassBinding, ClassPrimitive } from '@/primitive/class.js';
import { Runtime } from '@/runtime.js';
import { MockBackend } from '../../mocks.js';
import { createElement } from '../../test-utils.js';

describe('ClassPrimitive', () => {
  describe('name', () => {
    it('is a string that represents the primitive itself', () => {
      expect(ClassPrimitive.name, 'ClassPrimitive');
    });
  });

  describe('ensureValue()', () => {
    it.for([{ foo: true }, ['foo'], {}, []])(
      'asserts the value is a class specifier',
      (value) => {
        const part = {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: ':class',
        };
        const ensureValue: NonNullable<typeof ClassPrimitive.ensureValue> =
          ClassPrimitive.ensureValue!;

        expect(() => {
          ensureValue.call(ClassPrimitive, value, part);
        }).not.toThrow();
      },
    );

    it.for(['foo', null, undefined])(
      'throws an error if the value is not an object',
      (value) => {
        const part = {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: ':class',
        };
        const ensureValue: NonNullable<typeof ClassPrimitive.ensureValue> =
          ClassPrimitive.ensureValue!;

        expect(() => {
          ensureValue.call(ClassPrimitive, value, part);
        }).toThrow('The value of ClassPrimitive must be an object,');
      },
    );
  });

  describe('resolveBinding()', () => {
    it.for([':CLASS', ':class'])(
      'constructs a new AttributeBinding',
      (attributeName) => {
        const classes = { foo: true, bar: true, baz: false };
        const part = {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: attributeName,
        };
        const runtime = Runtime.create(new MockBackend());
        const binding = ClassPrimitive.resolveBinding(classes, part, runtime);

        expect(binding.type).toBe(ClassPrimitive);
        expect(binding.value).toBe(classes);
        expect(binding.part).toBe(part);
      },
    );

    it('throws an error if the part is not a ":class" attribute part', () => {
      const classes = { foo: true, bar: true, baz: false };
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      };
      const runtime = Runtime.create(new MockBackend());

      expect(() =>
        ClassPrimitive.resolveBinding(classes, part, runtime),
      ).toThrow('ClassPrimitive must be used in a ":class" attribute part,');
    });
  });
});

describe('ClassBinding', () => {
  describe('shouldBind()', () => {
    it('returns true if the committed classes does not exist', () => {
      const classes = { foo: true, bar: true, baz: false };
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':class',
      };
      const binding = new ClassBinding(classes, part);

      expect(binding.shouldBind(classes)).toBe(true);
    });

    it('returns true if any classes are not the same in the class list', () => {
      const classes = ['foo', 'bar', null];
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':class',
      };
      const binding = new ClassBinding(classes, part);
      const runtime = Runtime.create(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(binding.shouldBind(classes)).toBe(false);
      expect(binding.shouldBind(structuredClone(classes))).toBe(false);
      expect(binding.shouldBind({ foo: true, bar: true })).toBe(true);
      expect(binding.shouldBind({ foo: true, bar: true, baz: false })).toBe(
        true,
      );
      expect(binding.shouldBind(['foo bar'])).toBe(true);
      expect(binding.shouldBind(['foo', 'bar'])).toBe(true);
      expect(binding.shouldBind(['bar', 'foo'])).toBe(true);
    });

    it('returns true if any classes are not the same in the class map', () => {
      const classes = { foo: true, bar: true, baz: false };
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':class',
      };
      const binding = new ClassBinding(classes, part);
      const runtime = Runtime.create(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(binding.shouldBind(classes)).toBe(false);
      expect(binding.shouldBind(structuredClone(classes))).toBe(false);
      expect(binding.shouldBind({ foo: true, bar: true })).toBe(true);
      expect(binding.shouldBind({ foo: true, bar: true, baz: true })).toBe(
        true,
      );
      expect(binding.shouldBind(['foo bar'])).toBe(true);
      expect(binding.shouldBind(['foo', 'bar'])).toBe(true);
      expect(binding.shouldBind(['bar', 'foo'])).toBe(true);
    });
  });

  describe('commit()', () => {
    it('adds only valid class names in class map', () => {
      const classes1 = {
        _: 'foo',
        'bar baz': true,
        qux: true,
        quux: false,
      };
      const classes2 = {
        _: 'foo',
        'bar baz': null,
        qux: undefined,
        quux: true,
      };
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':class',
      };
      const binding = new ClassBinding(classes1, part);
      const runtime = Runtime.create(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('foo bar baz qux');

      binding.bind(classes2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('foo quux');

      binding.bind(classes1);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('foo bar baz qux');
    });

    it('adds only valid class names in class list', () => {
      const classes1 = ['foo', 'bar baz', 'qux', undefined];
      const classes2 = ['foo', null, undefined, 'quux'];
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':class',
      };
      const binding = new ClassBinding(classes1, part);
      const runtime = Runtime.create(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('foo bar baz qux');

      binding.bind(classes2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('foo quux');

      binding.bind(classes1);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('foo bar baz qux');
    });

    it('adds duplicated classs names correctly', () => {
      const classes1 = { _: 'foo bar', foo: true, bar: false };
      const classes2 = { _: 'foo', foo: false, bar: true };
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':class',
      };
      const binding = new ClassBinding(classes1, part);
      const runtime = Runtime.create(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('foo bar');

      binding.bind(classes2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('bar');

      binding.bind(classes1);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('foo');
    });

    it('can preserve preset class names', () => {
      const classes = { foo: true, bar: true };
      const part = {
        type: PartType.Attribute,
        node: createElement('div', { class: 'baz' }),
        name: 'class',
      };
      const binding = new ClassBinding(classes, part);
      const runtime = Runtime.create(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.getAttribute('class')).toBe('baz foo bar');
    });
  });

  describe('rollback()', () => {
    it('removes committed class names', () => {
      const classes = { foo: true, bar: true, baz: false };
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':class',
      };
      const binding = new ClassBinding(classes, part);
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
