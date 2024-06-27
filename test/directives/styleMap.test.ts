import { describe, expect, it, vi } from 'vitest';

import { directiveTag } from '../../src/binding.js';
import {
  StyleMapBinding,
  StyleMapDirective,
  styleMap as styleMapFunction,
} from '../../src/directives/styleMap.js';
import { PartType } from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockRenderingEngine } from '../mocks.js';

describe('styleMap()', () => {
  it('should construct a new StyleMapDirective', () => {
    const styleMap = { display: 'none' };
    const directive = styleMapFunction(styleMap);

    expect(directive.styleMap).toBe(styleMap);
  });
});

describe('StyleMapDirective', () => {
  describe('.constructor()', () => {
    it('should construct a new StyleMapDirective', () => {
      const styleMap = { display: 'none' };
      const directive = new StyleMapDirective(styleMap);

      expect(directive.styleMap).toBe(styleMap);
    });
  });

  describe('[directiveTag]()', () => {
    it('should return a new instance of ClassMapBinding', () => {
      const styleMap = { display: 'none' };
      const directive = new StyleMapDirective(styleMap);
      const updater = new SyncUpdater(new MockRenderingEngine());
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const binding = directive[directiveTag](part, updater);

      expect(binding.value).toBe(directive);
      expect(binding.part).toBe(part);
    });

    it('should throw an error if the part does not indicate "style" attribute', () => {
      const styleMap = { display: 'none' };
      const directive = new StyleMapDirective(styleMap);
      const updater = new SyncUpdater(new MockRenderingEngine());
      const part = {
        type: PartType.Attribute,
        name: 'data-style',
        node: document.createElement('div'),
      } as const;

      expect(() => directive[directiveTag](part, updater)).toThrow(
        'StyleDirective must be used in the "style" attribute.',
      );
    });
  });
});

describe('StyleMapBinding', () => {
  describe('.constructor()', () => {
    it('should construct a new ClassMapBinding', () => {
      const directive = new StyleMapDirective({ display: 'component' });
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const binding = new StyleMapBinding(directive, part);

      expect(binding.value).toBe(directive);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
    });
  });

  describe('.connect()', () => {
    it('should set styles to the element', () => {
      const directive = new StyleMapDirective({
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
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.connect(updater);
      updater.flush();

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
      const directive = new StyleMapDirective({
        color: 'black',
      });
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const binding = new StyleMapBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderingEngine());
      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
        'enqueueMutationEffect',
      );

      binding.connect(updater);
      binding.connect(updater);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });
  });

  describe('.bind()', () => {
    it('should remove gone styles from the element', () => {
      const directive = new StyleMapDirective({
        padding: '8px',
        margin: '8px',
      });
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const binding = new StyleMapBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.connect(updater);
      updater.flush();

      binding.bind(new StyleMapDirective({ padding: '0' }), updater);
      updater.flush();

      expect(part.node.style).toHaveLength(4);
      expect(part.node.style.getPropertyValue('padding')).toBe('0px');
    });

    it('should skip update if the styles are the same as the previous one', () => {
      const directive = new StyleMapDirective({
        color: 'black',
      });
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const binding = new StyleMapBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.connect(updater);
      updater.flush();

      binding.bind(directive, updater);

      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });

    it('should throw an error if the new value is not StyleMapDirective', () => {
      const directive = new StyleMapDirective({
        color: 'black',
      });
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const binding = new StyleMapBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      expect(() => {
        binding.bind(null as any, updater);
      }).toThrow(
        'A value must be a instance of "StyleMapDirective", but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should remove all styles from the element', () => {
      const directive = new StyleMapDirective({
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
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.connect(updater);
      updater.flush();

      binding.unbind(updater);
      updater.flush();

      expect(part.node.style).toHaveLength(0);
    });

    it('should skip updater if the current styles are empty', () => {
      const directive = new StyleMapDirective({});
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const binding = new StyleMapBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.unbind(updater);

      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const directive = new StyleMapDirective({ display: 'component' });
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
