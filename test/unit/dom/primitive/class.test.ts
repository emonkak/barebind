import { describe, expect, it } from 'vitest';
import { createAttributePart } from '@/dom/part.js';
import {
  type ClassMap,
  DOMClass,
  DOMClassBinding,
} from '@/dom/primitive/class.js';
import { createTestRuntime } from '../../../adapter.js';
import { createElement } from '../../../helpers.js';
import { SessionLauncher } from '../../../session-launcher.js';

describe('DOMClass', () => {
  describe('ensureValue()', () => {
    it('asserts the value is object', () => {
      const part = createAttributePart(document.createElement('div'), ':class');

      expect(() => {
        DOMClass.ensureValue({}, part);
        DOMClass.ensureValue([], part);
        DOMClass.ensureValue({ foo: true }, part);
        DOMClass.ensureValue(['foo'], part);
      }).not.toThrow();
    });

    it.for([
      'foo',
      null,
      undefined,
    ])('throws an error when the value is not object', (source) => {
      const part = createAttributePart(document.createElement('div'), ':class');

      expect(() => {
        DOMClass.ensureValue(source, part);
      }).toThrow('Class values must be object.');
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new Binding with DOMClass type', () => {
      const classes = { foo: true, bar: true, baz: false };
      const part = createAttributePart(document.createElement('div'), ':class');
      const runtime = createTestRuntime();
      const binding = DOMClass.resolveBinding(classes, part, runtime);

      expect(binding.type).toBe(DOMClass);
      expect(binding.value).toBe(classes);
      expect(binding.part).toBe(part);
    });
  });
});

describe('DOMClassBinding', () => {
  const launcher = new SessionLauncher(createTestRuntime());

  describe('shouldUpdate()', () => {
    it('returns true when there is no current class names', () => {
      const part = createAttributePart(document.createElement('div'), ':class');
      const binding = new DOMClassBinding({ foo: true }, part);

      expect(binding.shouldUpdate({ foo: true })).toBe(true);
    });

    it.each<[ClassMap, ClassMap, boolean]>([
      [{}, { a: true }, true],
      [{}, { a: false }, true],
      [[], ['a'], true],
      [{ a: true }, { a: false }, true],
      [{ a: true }, { a: true, b: false }, true],
      [['a'], ['a', 'b'], true],
      [{}, {}, false],
      [{}, [], false],
      [[], [], false],
      [{ a: true }, { a: true }, false],
      [{ a: true, b: true }, { a: true, b: true }, false],
      [{ a: true, b: true }, { b: true, a: true }, false],
      [['a'], ['a'], false],
      [['a', 'b'], ['a', 'b'], false],
    ])('returns $2 for updates from $0 to $1', (classNames1, classNames2, expectedResult) => {
      const part = createAttributePart(document.createElement('div'), ':class');
      const binding = new DOMClassBinding(classNames1, part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(binding.shouldUpdate(classNames2)).toBe(expectedResult);

      launcher.launchSession((session) => {
        binding.value = classNames2;
        binding.attach(session);
        binding.commit();
      });

      expect(binding.shouldUpdate(classNames1)).toBe(expectedResult);
    });
  });

  describe('commit/rollback()', () => {
    it.each<[ClassMap, string]>([
      [{}, ''],
      [[], ''],
      [{ a: true }, 'a'],
      [{ a: false }, ''],
      [{ a: true, b: true }, 'a b'],
      [{ a: true, b: null }, 'a'],
      [{ a: true, b: undefined }, 'a'],
      [{ a: true, 'b c': true }, 'a b c'],
      [['a'], 'a'],
      [['a', 'b'], 'a b'],
      [['a', null], 'a'],
      [['a', undefined], 'a'],
    ])('sets the class name from %s to "%s" and resets', (classTokens, expectedClassName) => {
      const part = createAttributePart(document.createElement('div'), ':class');
      const binding = new DOMClassBinding(classTokens, part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(part.node.className).toBe(expectedClassName);

      launcher.launchSession((session) => {
        binding.detach(session);
        binding.rollback();
      });

      expect(part.node.className).toBe('');
    });

    it('preserves existing class names', () => {
      const part = createAttributePart(
        createElement('div', { class: 'z' }),
        ':class',
      );
      const binding = new DOMClassBinding({ a: true, b: true }, part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(part.node.className).toContain('a b');
      expect(part.node.className).toContain('z');

      launcher.launchSession((session) => {
        binding.detach(session);
        binding.rollback();
      });

      expect(part.node.className).toBe('z');
    });
  });

  describe('commit()', () => {
    it.each<[ClassMap, ClassMap, string]>([
      [{ a: true }, {}, ''],
      [{ a: true }, { a: null }, ''],
      [{ a: true }, { a: undefined }, ''],
      [{ a: true, b: false }, { a: false, b: true }, 'b'],
      [{ a: true }, { b: true }, 'b'],
      [['a'], [], ''],
      [['a'], [null], ''],
      [['a'], [undefined], ''],
      [['a'], ['b'], 'b'],
    ])('updates class tokens from %s to %s, resulting in "%s"', (classToken1, classToken2, expectedClassName) => {
      const part = createAttributePart(document.createElement('div'), ':class');
      const binding = new DOMClassBinding(classToken1, part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      launcher.launchSession((session) => {
        binding.value = classToken2;
        binding.attach(session);
        binding.commit();
      });

      expect(part.node.className).toBe(expectedClassName);
    });
  });
});
