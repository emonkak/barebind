import { describe, expect, it } from 'vitest';
import { createAttributePart } from '@/dom/part.js';
import {
  DOMStyle,
  DOMStyleBinding,
  type StyleMap,
} from '@/dom/primitive/style.js';
import { createTestRuntime } from '../../../adapter.js';
import { createElement } from '../../../helpers.js';
import { SessionLauncher } from '../../../session-launcher.js';

describe('DOMStyle', () => {
  describe('ensureValue()', () => {
    it('asserts the value is object', () => {
      const part = createAttributePart(document.createElement('div'), ':style');

      expect(() => {
        DOMStyle.ensureValue!.call(DOMStyle, { color: 'red' }, part);
      }).not.toThrow();
    });

    it.for([
      null,
      undefined,
      'foo',
    ])('throws an error when the value is not object', (value) => {
      const part = createAttributePart(document.createElement('div'), ':style');

      expect(() => {
        DOMStyle.ensureValue!.call(DOMStyle, value, part);
      }).toThrow('Style values must be object.');
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new StyleBinding with DOMStyle type', () => {
      const style = { color: 'red' };
      const part = createAttributePart(document.createElement('div'), ':style');
      const runtime = createTestRuntime();
      const binding = DOMStyle.resolveBinding(style, part, runtime);

      expect(binding.type).toBe(DOMStyle);
      expect(binding.value).toBe(style);
      expect(binding.part).toBe(part);
    });
  });
});

describe('DOMStyleBinding', () => {
  const launcher = new SessionLauncher(createTestRuntime());

  describe('shouldUpdate', () => {
    it('returns true when there are no current properties', () => {
      const style = { color: 'red' };
      const part = createAttributePart(document.createElement('div'), ':style');
      const binding = new DOMStyleBinding(style, part);

      expect(binding.shouldUpdate(style)).toBe(true);
    });

    it.each<[StyleMap, StyleMap, boolean]>([
      [{ margin: '2px' }, {}, true],
      [{ margin: '2px' }, { margin: null }, true],
      [{ margin: '2px' }, { margin: undefined }, true],
      [{ margin: '2px' }, { margin: '0' }, true],
      [{ margin: '2px' }, { padding: '2px' }, true],
      [
        { margin: '2px', padding: '2px' },
        { margin: '2px', padding: '0' },
        true,
      ],
      [{ margin: '2px' }, { margin: '2px' }, false],
      [
        { margin: '2px', padding: '2px' },
        { padding: '2px', margin: '2px' },
        false,
      ],
    ])('returns $2 for updates from $0 to $1', (styles1, styles2, expectedResult) => {
      const part = createAttributePart(document.createElement('div'), ':style');
      const binding = new DOMStyleBinding(styles1, part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(binding.shouldUpdate(styles2)).toBe(expectedResult);

      launcher.launchSession((session) => {
        binding.value = styles2;
        binding.attach(session);
        binding.commit();
      });

      expect(binding.shouldUpdate(styles1)).toBe(expectedResult);
    });
  });

  describe('commit/rollback()', () => {
    it.each<[StyleMap, string]>([
      [{}, ''],
      [{ '--css-variable': '1' }, '--css-variable: 1;'],
      [
        { color: 'red', backgroundColor: 'white' },
        `color: red; background-color: white;`,
      ],
      [{ webkitFilter: 'blur(8px)' }, `filter: blur(8px);`],
    ])('sets style from %s to "%s" and resets', (styleProps, expectedStyle) => {
      const part = createAttributePart(document.createElement('div'), ':style');
      const binding = new DOMStyleBinding(styleProps, part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(part.node.style.cssText).toBe(expectedStyle);

      launcher.launchSession((session) => {
        binding.detach(session);
        binding.rollback();
      });

      expect(part.node.style.cssText).toBe('');
    });

    it('preserves existing style properties', () => {
      const part = createAttributePart(
        createElement('div', { style: 'margin: 2px;' }),
        ':style',
      );
      const binding = new DOMStyleBinding(
        { color: 'red', backgroundColor: 'white' },
        part,
      );

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(part.node.style.cssText).toContain('margin: 2px;');
      expect(part.node.style.cssText).toContain('color: red;');
      expect(part.node.style.cssText).toContain('background-color: white;');

      launcher.launchSession((session) => {
        binding.detach(session);
        binding.rollback();
      });

      expect(part.node.style.cssText).toBe('margin: 2px;');
    });
  });

  describe('commit()', () => {
    it.each<[StyleMap, StyleMap, string]>([
      [{}, {}, ''],
      [{ color: 'red' }, { color: 'blue' }, 'color: blue;'],
      [{ color: 'red' }, { color: null }, ''],
      [{ color: 'red' }, { color: undefined }, ''],
      [
        { color: 'red' },
        { color: 'red', backgroundColor: 'white' },
        'color: red; background-color: white;',
      ],
    ])('updates style properties from %s to %s, resulting in "%s"', (styleProps1, styleProps2, expectedStyle) => {
      const part = createAttributePart(document.createElement('div'), ':style');
      const binding = new DOMStyleBinding(styleProps1, part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      launcher.launchSession((session) => {
        binding.value = styleProps2;
        binding.attach(session);
        binding.commit();
      });

      expect(part.node.style.cssText).toBe(expectedStyle);
    });
  });
});
