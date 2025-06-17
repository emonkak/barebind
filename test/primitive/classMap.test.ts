import { describe, expect, it } from 'vitest';

import type { Primitive } from '../../src/directive.js';
import { PartType } from '../../src/part.js';
import {
  type ClassMap,
  ClassMapBinding,
  ClassMapPrimitive,
} from '../../src/primitive/classMap.js';
import { UpdateEngine } from '../../src/updateEngine.js';
import { MockRenderHost } from '../mocks.js';
import { createElement } from '../testUtils.js';

describe('ClassMapPrimitive', () => {
  describe('name', () => {
    it('is a string that represents the primitive itself', () => {
      expect(ClassMapPrimitive.name, 'ClassMapPrimitive');
    });
  });

  describe('ensureValue()', () => {
    it('asserts the value is an object', () => {
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':classmap',
      } as const;
      const ensureValue: NonNullable<Primitive<ClassMap>['ensureValue']> =
        ClassMapPrimitive.ensureValue;

      expect(() => {
        ensureValue({ foo: true }, part);
      }).not.toThrow();
    });

    it.each([[null], [undefined], ['foo']])(
      'throws the error if the value is not an object',
      (value) => {
        const part = {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: ':classmap',
        } as const;
        const ensureValue: NonNullable<Primitive<ClassMap>['ensureValue']> =
          ClassMapPrimitive.ensureValue;

        expect(() => {
          ensureValue(value, part);
        }).toThrow('The value of ClassMapPrimitive must be object,');
      },
    );
  });

  describe('resolveBinding()', () => {
    it.each([[':CLASSMAP'], [':classmap']])(
      'constructs a new AttributeBinding',
      (attributeName) => {
        const classes = { foo: true, bar: true, baz: false };
        const part = {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: attributeName,
        } as const;
        const context = new UpdateEngine(new MockRenderHost());
        const binding = ClassMapPrimitive.resolveBinding(
          classes,
          part,
          context,
        );

        expect(binding.directive).toBe(ClassMapPrimitive);
        expect(binding.value).toBe(classes);
        expect(binding.part).toBe(part);
      },
    );

    it('should throw the error if the part is not a ":classmap" attribute part', () => {
      const classes = { foo: true, bar: true, baz: false };
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      } as const;
      const context = new UpdateEngine(new MockRenderHost());

      expect(() =>
        ClassMapPrimitive.resolveBinding(classes, part, context),
      ).toThrow(
        'ClassMapPrimitive must be used in a ":classmap" attribute part,',
      );
    });
  });
});

describe('ClassMapBinding', () => {
  describe('shouldBind()', () => {
    it('returns true if the committed classes does not exist', () => {
      const classes = { foo: true, bar: true, baz: false };
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':classlist',
      } as const;
      const binding = new ClassMapBinding(classes, part);

      expect(binding.shouldBind(classes)).toBe(true);
    });

    it('returns true if any class are not the same as the committed one', () => {
      const classes1 = { foo: true, bar: true, baz: false };
      const classes2 = { foo: true, bar: false, baz: true };
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':classlist',
      } as const;
      const binding = new ClassMapBinding(classes1, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit();

      expect(binding.shouldBind(classes1)).toBe(false);
      expect(binding.shouldBind(classes2)).toBe(true);
    });
  });

  describe('commit()', () => {
    it('adds non-null elements as class names', () => {
      const classes1 = { foo: true, bar: true, baz: false };
      const classes2 = { foo: true, bar: false, baz: true };
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':classlist',
      } as const;
      const binding = new ClassMapBinding(classes1, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit();

      expect(part.node.getAttribute('class')).toBe('foo bar');

      binding.bind(classes2);
      binding.connect(context);
      binding.commit();

      expect(part.node.getAttribute('class')).toBe('foo baz');
    });

    it('should preserve preset class names', () => {
      const classes = { foo: true, bar: true };
      const part = {
        type: PartType.Attribute,
        node: createElement('div', { class: 'baz' }),
        name: 'class',
      } as const;
      const binding = new ClassMapBinding(classes, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit();

      expect(part.node.getAttribute('class')).toBe('baz foo bar');
    });

    it('should remove preset class names if it is overwritten and deleted', () => {
      const classes1 = { foo: true, bar: true };
      const classes2 = {};
      const part = {
        type: PartType.Attribute,
        node: createElement('div', { class: 'foo bar baz' }),
        name: 'class',
      } as const;
      const binding = new ClassMapBinding(classes1, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit();

      expect(part.node.getAttribute('class')).toBe('foo bar baz');

      binding.bind(classes2);
      binding.connect(context);
      binding.commit();

      expect(part.node.getAttribute('class')).toBe('baz');
    });
  });

  describe('rollback()', () => {
    it('removes committed class names', () => {
      const classes = { foo: true, bar: true, baz: false };
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':classlist',
      } as const;
      const binding = new ClassMapBinding(classes, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit();

      expect(part.node.getAttribute('class')).toBe('foo bar');

      binding.disconnect(context);
      binding.rollback();

      expect(part.node.getAttribute('class')).toBe('');
    });
  });
});
