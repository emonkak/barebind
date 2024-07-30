import { describe, expect, it, vi } from 'vitest';

import { StyleMapBinding, styleMap } from '../../src/directives/styleMap.js';
import {
  PartType,
  createUpdateContext,
  directiveTag,
} from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockUpdateHost } from '../mocks.js';

describe('styleMap()', () => {
  it('should construct a new StyleMap', () => {
    const styleDeclaration = { display: 'none' };
    const directive = styleMap(styleDeclaration);

    expect(directive.styleDeclaration).toBe(styleDeclaration);
  });
});

describe('StyleMap', () => {
  describe('[directiveTag]()', () => {
    it('should return a new instance of StyleMapBinding', () => {
      const styleDeclaration = { display: 'none' };
      const directive = styleMap(styleDeclaration);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const binding = directive[directiveTag](part, context);

      expect(binding.value).toBe(directive);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
    });

    it('should throw an error if the part does not indicate "style" attribute', () => {
      const styleDeclaration = { display: 'none' };
      const directive = styleMap(styleDeclaration);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const part = {
        type: PartType.Attribute,
        name: 'data-style',
        node: document.createElement('div'),
      } as const;

      expect(() => directive[directiveTag](part, context)).toThrow(
        'StyleMap directive must be used in a "style" attribute,',
      );
    });
  });
});

describe('StyleMapBinding', () => {
  describe('.connect()', () => {
    it('should set styles to the element', () => {
      const directive = styleMap({
        '--my-css-property': '1',
        color: 'black',
        margin: '10px',
        webkitFilter: 'blur(8px)',
        filter: 'blur(8px)',
      });
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const binding = new StyleMapBinding(directive, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      binding.connect(context);
      updater.flushUpdate(host);

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
      const directive = styleMap({
        color: 'black',
      });
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const binding = new StyleMapBinding(directive, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
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
      const directive1 = styleMap({
        padding: '8px',
        margin: '8px',
      });
      const directive2 = styleMap({
        padding: '0',
      });
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const binding = new StyleMapBinding(directive1, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      binding.connect(context);
      updater.flushUpdate(host);

      binding.bind(directive2, context);
      updater.flushUpdate(host);

      expect(binding.value).toBe(directive2);
      expect(part.node.style).toHaveLength(4);
      expect(part.node.style.getPropertyValue('padding')).toBe('0px');
    });

    it('should skip an update if the styles are the same as previous ones', () => {
      const directive1 = styleMap({
        color: 'black',
      });
      const directive2 = styleMap(directive1.styleDeclaration);
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const binding = new StyleMapBinding(directive1, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      binding.connect(context);
      updater.flushUpdate(host);

      binding.bind(directive2, context);

      expect(binding.value).toBe(directive1);
      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });

    it('should throw an error if the new value is not StyleMap', () => {
      const directive = styleMap({
        color: 'black',
      });
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const binding = new StyleMapBinding(directive, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      expect(() => {
        binding.bind(null as any, context);
      }).toThrow(
        'A value must be a instance of StyleMap directive, but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should remove all styles from the element', () => {
      const directive = styleMap({
        '--my-css-property': '1',
        color: 'black',
        margin: '10px',
        webkitFilter: 'blur(8px)',
        filter: 'blur(8px)',
      });
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const binding = new StyleMapBinding(directive, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      binding.connect(context);
      updater.flushUpdate(host);

      binding.unbind(context);
      updater.flushUpdate(host);

      expect(part.node.style).toHaveLength(0);
    });

    it('should skip an update if the current styles are empty', () => {
      const directive = styleMap({});
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const binding = new StyleMapBinding(directive, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      binding.unbind(context);

      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const directive = styleMap({ display: 'component' });
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const binding = new StyleMapBinding(directive, part);

      binding.disconnect();
    });
  });
});
