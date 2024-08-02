import { describe, expect, it, vi } from 'vitest';

import { PartType, UpdateContext, directiveTag } from '../../src/baseTypes.js';
import { StyleMapBinding, styleMap } from '../../src/directives/styleMap.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockUpdateHost } from '../mocks.js';

describe('styleMap()', () => {
  it('should construct a new StyleMap directive', () => {
    const styleDeclaration = { display: 'none' };
    const value = styleMap(styleDeclaration);

    expect(value.styles).toBe(styleDeclaration);
  });
});

describe('StyleMap', () => {
  describe('[directiveTag]()', () => {
    it('should return a new StyleMapBinding', () => {
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value = styleMap({ display: 'none' });
      const binding = value[directiveTag](part, context);

      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
    });

    it('should throw an error if the part does not indicate "style" attribute', () => {
      const part = {
        type: PartType.Attribute,
        name: 'data-style',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value = styleMap({ display: 'none' });

      expect(() => value[directiveTag](part, context)).toThrow(
        'StyleMap directive must be used in a "style" attribute,',
      );
    });
  });
});

describe('StyleMapBinding', () => {
  describe('.connect()', () => {
    it('should set styles to the element', () => {
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value = styleMap({
        '--my-css-property': '1',
        color: 'black',
        margin: '10px',
        webkitFilter: 'blur(8px)',
        filter: 'blur(8px)',
      });
      const binding = new StyleMapBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      expect(part.node.style).toHaveLength(7);
      expect(part.node.style.getPropertyValue('--my-css-property')).toBe('1');
      expect(part.node.style.getPropertyValue('color')).toBe('black');
      expect(part.node.style.getPropertyValue('margin')).toBe('10px');
      expect(part.node.style.getPropertyValue('-webkit-filter')).toBe(
        'blur(8px)',
      );
      expect(part.node.style.getPropertyValue('filter')).toBe('blur(8px)');
    });

    it('should do nothing if the update is already scheduled', () => {
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value = styleMap({
        color: 'black',
      });
      const binding = new StyleMapBinding(value, part);

      const enqueueMutationEffectSpy = vi.spyOn(
        context,
        'enqueueMutationEffect',
      );

      binding.connect(context);
      binding.connect(context);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });
  });

  describe('.bind()', () => {
    it('should remove gone styles from the element', () => {
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value1 = styleMap({
        padding: '8px',
        margin: '8px',
      });
      const value2 = styleMap({
        padding: '0',
      });
      const binding = new StyleMapBinding(value1, part);

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);
      context.flushUpdate();

      expect(binding.value).toBe(value2);
      expect(part.node.style).toHaveLength(4);
      expect(part.node.style.getPropertyValue('padding')).toBe('0px');
    });

    it('should skip an update if the styles are the same as previous ones', () => {
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value1 = styleMap({
        color: 'black',
      });
      const value2 = styleMap(value1.styles);
      const binding = new StyleMapBinding(value1, part);

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);

      expect(binding.value).toBe(value2);
      expect(context.isPending()).toBe(false);
    });

    it('should throw an error if the new value is not StyleMap', () => {
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value = styleMap({
        color: 'black',
      });
      const binding = new StyleMapBinding(value, part);

      expect(() => {
        binding.bind(null as any, context);
      }).toThrow(
        'A value must be a instance of StyleMap directive, but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should remove all styles from the element', () => {
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value = styleMap({
        '--my-css-property': '1',
        color: 'black',
        margin: '10px',
        webkitFilter: 'blur(8px)',
        filter: 'blur(8px)',
      });
      const binding = new StyleMapBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      binding.unbind(context);
      context.flushUpdate();

      expect(part.node.style).toHaveLength(0);
    });

    it('should skip an update if the current styles are empty', () => {
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value = styleMap({});
      const binding = new StyleMapBinding(value, part);

      binding.unbind(context);

      expect(context.isPending()).toBe(false);
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;

      const value = styleMap({ display: 'component' });
      const binding = new StyleMapBinding(value, part);

      binding.disconnect();
    });
  });
});
