import { describe, expect, it } from 'vitest';

import { PartType } from '@/part.js';
import { StyleBinding, StylePrimitive } from '@/primitive/style.js';
import { Runtime } from '@/runtime.js';
import { MockRenderHost } from '../../mocks.js';
import { createElement } from '../../test-utils.js';

describe('StylePrimitive', () => {
  describe('displayName', () => {
    it('is a string that represents the primitive itself', () => {
      expect(StylePrimitive.displayName, 'StylePrimitive');
    });
  });

  describe('ensureValue()', () => {
    it('asserts the value is a object', () => {
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':style',
      };
      const ensureValue: NonNullable<typeof StylePrimitive.ensureValue> =
        StylePrimitive.ensureValue!;

      expect(() => {
        ensureValue({ color: 'red' }, part);
      }).not.toThrow();
    });

    it.each([[null], [undefined], ['foo']])(
      'throws an error if the value is not object',
      (value) => {
        const part = {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: ':style',
        };
        const ensureValue: NonNullable<typeof StylePrimitive.ensureValue> =
          StylePrimitive.ensureValue!;

        expect(() => {
          ensureValue(value, part);
        }).toThrow('The value of StylePrimitive must be object,');
      },
    );
  });

  describe('resolveBinding()', () => {
    it.each([[':STYLE'], [':style']])(
      'constructs a new StyleBinding',
      (attributeName) => {
        const style = { color: 'red' };
        const part = {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: attributeName,
        };
        const runtime = new Runtime(new MockRenderHost());
        const binding = StylePrimitive.resolveBinding(style, part, runtime);

        expect(binding.type).toBe(StylePrimitive);
        expect(binding.value).toBe(style);
        expect(binding.part).toBe(part);
      },
    );

    it('should throw the error if the part is not a ":style" attribute part', () => {
      const style = { color: 'red' };
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'style',
      };
      const runtime = new Runtime(new MockRenderHost());

      expect(() => StylePrimitive.resolveBinding(style, part, runtime)).toThrow(
        'StylePrimitive must be used in a ":style" attribute part,',
      );
    });
  });
});

describe('StyleBinding', () => {
  describe('shouldBind', () => {
    it('returns true if the committed value does not exist', () => {
      const style = { color: 'red' };
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':style',
      };
      const binding = new StyleBinding(style, part);

      expect(binding.shouldBind(style)).toBe(true);
    });

    it('returns true if the style has changed from the committed one', () => {
      const style1 = { margin: '2px' };
      const style2 = { padding: '2px' };
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':style',
      };
      const binding = new StyleBinding(style1, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(binding.shouldBind({ ...style1 })).toBe(false);
      expect(binding.shouldBind(style2)).toBe(true);
    });
  });

  describe('commit()', () => {
    it('sets style properties to the element', () => {
      const style1 = {
        '--my-css-variable': '1',
        color: 'red',
        backgroundColor: 'blue',
        webkitFilter: 'grayscale(100%)',
      };
      const style2 = {
        '--my-css-variable': '2',
        color: null,
        backgroundColor: undefined,
      };
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':style',
      };
      const binding = new StyleBinding(style1, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.style.cssText).toBe(
        '--my-css-variable: 1; color: red; background-color: blue; filter: grayscale(100%);',
      );

      binding.bind(style2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.style.cssText).toBe('--my-css-variable: 2;');
    });

    it('should preserve preset style properties', () => {
      const style = {
        color: 'red',
      };
      const part = {
        type: PartType.Attribute,
        node: createElement('div', { style: 'background-color: blue' }),
        name: ':style',
      };
      const binding = new StyleBinding(style, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.style.cssText).toBe(
        'background-color: blue; color: red;',
      );
    });

    it('should remove preset style properties if it is overwritten and deleted', () => {
      const style1 = {
        backgroundColor: 'red',
      };
      const style2 = {};
      const part = {
        type: PartType.Attribute,
        node: createElement('div', { style: 'background-color: blue' }),
        name: ':style',
      };
      const binding = new StyleBinding(style1, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.style.cssText).toBe('background-color: red;');

      binding.bind(style2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.style.cssText).toBe('');
    });
  });

  describe('rollback()', () => {
    it('removes committed style properties', () => {
      const style = {
        color: 'red',
        backgroundColor: 'blue',
        marginBlock: null,
        marginInline: undefined,
      };
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':classlist',
      };
      const binding = new StyleBinding(style, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.style.cssText).toBe(
        'color: red; background-color: blue;',
      );

      binding.disconnect(runtime);
      binding.rollback(runtime);

      expect(part.node.style.cssText).toBe('');
    });
  });
});
