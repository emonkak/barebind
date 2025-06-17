import { describe, expect, it } from 'vitest';

import type { Primitive } from '../../src/directive.js';
import { PartType } from '../../src/part.js';
import {
  type ClassList,
  ClassListBinding,
  ClassListPrimitive,
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
    it('asserts the value is an array', () => {
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':classlist',
      } as const;
      const ensureValue: NonNullable<Primitive<ClassList>['ensureValue']> =
        ClassListPrimitive.ensureValue;

      expect(() => {
        ensureValue(['foo'], part);
      }).not.toThrow();
    });

    it.each([[null], [undefined], ['foo']])(
      'throws the error if the value is not an array',
      (value) => {
        const part = {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: ':classlist',
        } as const;
        const ensureValue: NonNullable<Primitive<ClassList>['ensureValue']> =
          ClassListPrimitive.ensureValue;

        expect(() => {
          ensureValue(value, part);
        }).toThrow('The value of ClassListPrimitive must be array,');
      },
    );
  });

  describe('resolveBinding()', () => {
    it.each([[':CLASSLIST'], [':classlist']])(
      'constructs a new AttributeBinding',
      (attributeName) => {
        const classes = ['foo', 'bar', null];
        const part = {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: attributeName,
        } as const;
        const context = new UpdateEngine(new MockRenderHost());
        const binding = ClassListPrimitive.resolveBinding(
          classes,
          part,
          context,
        );

        expect(binding.directive).toBe(ClassListPrimitive);
        expect(binding.value).toBe(classes);
        expect(binding.part).toBe(part);
      },
    );

    it('throws the error if the part is not a ":classlist" attribute part', () => {
      const classes = ['foo', 'bar', null];
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      } as const;
      const context = new UpdateEngine(new MockRenderHost());

      expect(() =>
        ClassListPrimitive.resolveBinding(classes, part, context),
      ).toThrow(
        'ClassListPrimitive must be used in a ":classlist" attribute part,',
      );
    });
  });
});

describe('ClassListBinding', () => {
  describe('shouldBind()', () => {
    it('returns true if the committed classes does not exist', () => {
      const classes = ['foo', 'bar', null];
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':classlist',
      } as const;
      const binding = new ClassListBinding(classes, part);

      expect(binding.shouldBind(classes)).toBe(true);
    });

    it('returns true if any class are not the same as the committed one', () => {
      const classes1 = ['foo', 'bar', null];
      const classes2 = [null, 'bar'];
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':classlist',
      } as const;
      const binding = new ClassListBinding(classes1, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit();

      expect(binding.shouldBind(classes1)).toBe(false);
      expect(binding.shouldBind(classes2)).toBe(true);
    });
  });

  describe('commit()', () => {
    it('adds non-null elements as class names', () => {
      const classes1 = ['foo', 'bar', null];
      const classes2 = [null, 'bar'];
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':classlist',
      } as const;
      const binding = new ClassListBinding(classes1, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit();

      expect(part.node.getAttribute('class')).toBe('foo bar');

      binding.bind(classes2);
      binding.connect(context);
      binding.commit();

      expect(part.node.getAttribute('class')).toBe('bar');
    });

    it('should preserve preset class names', () => {
      const classes = ['foo', 'bar'];
      const part = {
        type: PartType.Attribute,
        node: createElement('div', { class: 'baz' }),
        name: 'class',
      } as const;
      const binding = new ClassListBinding(classes, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit();

      expect(part.node.getAttribute('class')).toBe('baz foo bar');
    });

    it('shouldd remove preset class names if it is overwritten and deleted', () => {
      const classes1 = ['foo', 'bar'];
      const classes2: string[] = [];
      const part = {
        type: PartType.Attribute,
        node: createElement('div', { class: 'foo bar baz' }),
        name: 'class',
      } as const;
      const binding = new ClassListBinding(classes1, part);
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
      const classes = ['foo', 'bar', null];
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':classlist',
      } as const;
      const binding = new ClassListBinding(classes, part);
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
