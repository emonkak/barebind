import { describe, expect, it } from 'vitest';

import { PartType } from '@/internal.js';
import { StyleBinding, StylePrimitive } from '@/primitive/style.js';
import {
  createElement,
  createRuntime,
  UpdateHelper,
} from '../../test-helpers.js';

describe('StylePrimitive', () => {
  describe('name', () => {
    it('is a string that represents the primitive itself', () => {
      expect(StylePrimitive.name, 'StylePrimitive');
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
        ensureValue.call(StylePrimitive, { color: 'red' }, part);
      }).not.toThrow();
    });

    it.for([null, undefined, 'foo'])(
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
          ensureValue.call(StylePrimitive, value, part);
        }).toThrow('The value of StylePrimitive must be an object,');
      },
    );
  });

  describe('resolveBinding()', () => {
    it.for([':STYLE', ':style'])(
      'constructs a new StyleBinding',
      (attributeName) => {
        const style = { color: 'red' };
        const part = {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: attributeName,
        };
        const runtime = createRuntime();
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
      const runtime = createRuntime();

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
      const helper = new UpdateHelper();

      SESSION: {
        helper.startSession((context) => {
          binding.connect(context);
          binding.commit();
        });

        expect(binding.shouldBind({ ...style1 })).toBe(false);
        expect(binding.shouldBind(style2)).toBe(true);
      }
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
      const helper = new UpdateHelper();

      SESSION1: {
        helper.startSession((context) => {
          binding.connect(context);
          binding.commit();
        });

        expect(part.node.style.cssText).toBe(
          '--my-css-variable: 1; color: red; background-color: blue; filter: grayscale(100%);',
        );
      }

      SESSION2: {
        helper.startSession((context) => {
          binding.value = style2;
          binding.connect(context);
          binding.commit();
        });

        expect(part.node.style.cssText).toBe('--my-css-variable: 2;');
      }
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
      const helper = new UpdateHelper();

      SESSION: {
        helper.startSession((context) => {
          binding.connect(context);
          binding.commit();
        });

        expect(part.node.style.cssText).toBe(
          'background-color: blue; color: red;',
        );
      }
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
      const helper = new UpdateHelper();

      SESSION1: {
        helper.startSession((context) => {
          binding.connect(context);
          binding.commit();
        });

        expect(part.node.style.cssText).toBe('background-color: red;');
      }

      SESSION2: {
        helper.startSession((context) => {
          binding.value = style2;
          binding.connect(context);
          binding.commit();
        });

        expect(part.node.style.cssText).toBe('');
      }
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
        name: ':class',
      };
      const binding = new StyleBinding(style, part);
      const helper = new UpdateHelper();

      SESSION1: {
        helper.startSession((context) => {
          binding.connect(context);
          binding.commit();
        });

        expect(part.node.style.cssText).toBe(
          'color: red; background-color: blue;',
        );
      }

      SESSION2: {
        helper.startSession((context) => {
          binding.disconnect(context);
          binding.rollback();
        });

        expect(part.node.style.cssText).toBe('');
      }
    });
  });
});
