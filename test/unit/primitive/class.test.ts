import { describe, expect, it } from 'vitest';
import { createAttributePart } from '@/part.js';
import { ClassBinding, ClassType } from '@/primitive/class.js';
import { createRuntime } from '../../mocks.js';
import { createElement } from '../../test-helpers.js';
import { TestUpdater } from '../../test-updater.js';

describe('ClassType', () => {
  describe('ensureValue()', () => {
    it.for([
      { foo: true },
      ['foo'],
      {},
      [],
    ])('asserts the value is a class specifier', (source) => {
      const part = createAttributePart(document.createElement('div'), ':class');

      expect(() => {
        ClassType.ensureValue!.call(ClassType, source, part);
      }).not.toThrow();
    });

    it.for([
      'foo',
      null,
      undefined,
    ])('throws an error if the value is not an object', (source) => {
      const part = createAttributePart(document.createElement('div'), ':class');

      expect(() => {
        ClassType.ensureValue!.call(ClassType, source, part);
      }).toThrow('ClassType values must be object.');
    });
  });

  describe('resolveBinding()', () => {
    it.for([
      ':CLASS',
      ':class',
    ])('constructs a new AttributeBinding with "%s" attribute', (attributeName) => {
      const classes = { foo: true, bar: true, baz: false };
      const part = createAttributePart(
        document.createElement('div'),
        attributeName,
      );
      const runtime = createRuntime();
      const binding = ClassType.resolveBinding(classes, part, runtime);

      expect(binding).toBeInstanceOf(ClassBinding);
      expect(binding.type).toBe(ClassType);
      expect(binding.value).toBe(classes);
      expect(binding.part).toBe(part);
    });
  });
});

describe('ClassBinding', () => {
  describe('shouldUpdate()', () => {
    it('returns true if the committed classes does not exist', () => {
      const classes = { foo: true, bar: true, baz: false };
      const part = createAttributePart(document.createElement('div'), ':class');
      const binding = new ClassBinding(classes, part);

      expect(binding.shouldUpdate(classes)).toBe(true);
    });

    it('returns true if any classes are not the same in the class list', () => {
      const classes = ['foo', 'bar', null];
      const part = createAttributePart(document.createElement('div'), ':class');
      const binding = new ClassBinding(classes, part);
      const updater = new TestUpdater();

      SESSION: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(binding.shouldUpdate(classes)).toBe(false);
        expect(binding.shouldUpdate(structuredClone(classes))).toBe(false);
        expect(binding.shouldUpdate({ foo: true, bar: true })).toBe(true);
        expect(binding.shouldUpdate({ foo: true, bar: true, baz: false })).toBe(
          true,
        );
        expect(binding.shouldUpdate(['foo bar'])).toBe(true);
        expect(binding.shouldUpdate(['foo', 'bar'])).toBe(true);
        expect(binding.shouldUpdate(['bar', 'foo'])).toBe(true);
      }
    });

    it('returns true if any classes are not the same in the class map', () => {
      const classes = { foo: true, bar: true, baz: false };
      const part = createAttributePart(document.createElement('div'), ':class');
      const binding = new ClassBinding(classes, part);
      const updater = new TestUpdater();

      SESSION: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(binding.shouldUpdate(classes)).toBe(false);
        expect(binding.shouldUpdate(structuredClone(classes))).toBe(false);
        expect(binding.shouldUpdate({ foo: true, bar: true })).toBe(true);
        expect(binding.shouldUpdate({ foo: true, bar: true, baz: true })).toBe(
          true,
        );
        expect(binding.shouldUpdate(['foo bar'])).toBe(true);
        expect(binding.shouldUpdate(['foo', 'bar'])).toBe(true);
        expect(binding.shouldUpdate(['bar', 'foo'])).toBe(true);
      }
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
      const part = createAttributePart(document.createElement('div'), ':class');
      const binding = new ClassBinding(classes1, part);
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.getAttribute('class')).toBe('foo bar baz qux');
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.value = classes2;
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.getAttribute('class')).toBe('foo quux');
      }

      SESSION3: {
        updater.startUpdate((session) => {
          binding.value = classes1;
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.getAttribute('class')).toBe('foo bar baz qux');
      }
    });

    it('adds only valid class names in class list', () => {
      const classes1 = ['foo', 'bar baz', 'qux', undefined];
      const classes2 = ['foo', null, '', 'quux'];
      const part = createAttributePart(document.createElement('div'), ':class');
      const binding = new ClassBinding(classes1, part);
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.getAttribute('class')).toBe('foo bar baz qux');
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.value = classes2;
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.getAttribute('class')).toBe('foo quux');
      }

      SESSION3: {
        updater.startUpdate((session) => {
          binding.value = classes1;
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.getAttribute('class')).toBe('foo bar baz qux');
      }
    });

    it('adds duplicated classs names correctly', () => {
      const classes1 = { _: 'foo bar', foo: true, bar: false };
      const classes2 = { _: 'foo', foo: false, bar: true };
      const part = createAttributePart(document.createElement('div'), ':class');
      const binding = new ClassBinding(classes1, part);
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.getAttribute('class')).toBe('foo bar');
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.value = classes2;
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.getAttribute('class')).toBe('bar');
      }

      SESSION3: {
        updater.startUpdate((session) => {
          binding.value = classes1;
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.getAttribute('class')).toBe('foo');
      }
    });

    it('preserves preset class names', () => {
      const classes = { foo: true, bar: true };
      const part = createAttributePart(
        createElement('div', { class: 'baz' }),
        ':class',
      );
      const binding = new ClassBinding(classes, part);
      const updater = new TestUpdater();

      SESSION: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.getAttribute('class')).toBe('baz foo bar');
      }
    });
  });

  describe('rollback()', () => {
    it('removes committed class names', () => {
      const classes = { foo: true, bar: true, baz: false };
      const part = createAttributePart(document.createElement('div'), ':class');
      const binding = new ClassBinding(classes, part);
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.getAttribute('class')).toBe('foo bar');
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.detach(session);
          binding.rollback();
        });

        expect(part.node.getAttribute('class')).toBe('');
      }
    });
  });
});
