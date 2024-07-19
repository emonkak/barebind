import { describe, expect, it, vi } from 'vitest';

import { RenderContext } from '../src/renderContext.js';
import { RenderState } from '../src/renderState.js';
import { EffectPhase, type Hook, HookType, PartType } from '../src/types.js';
import { SyncUpdater } from '../src/updater/syncUpdater.js';
import { MockBlock, MockTemplate } from './mocks.js';

describe('RenderState', () => {
  describe('.flushEffects()', () => {
    it('should perform given effects', () => {
      const state = new RenderState();
      const effect1 = {
        commit: vi.fn(),
      };
      const effect2 = {
        commit: vi.fn(),
      };
      state.flushEffects([effect1, effect2], EffectPhase.Passive);

      expect(effect1.commit).toHaveBeenCalledOnce();
      expect(effect1.commit).toHaveBeenCalledWith(EffectPhase.Passive);
      expect(effect2.commit).toHaveBeenCalledOnce();
      expect(effect2.commit).toHaveBeenCalledWith(EffectPhase.Passive);
    });
  });

  describe('.getHTMLTemplate()', () => {
    it('should create a HTML template from tokens', () => {
      const state = new RenderState();
      const [tokens, data] = tmpl`<div>Hello, ${'World'}!</div>`;
      const template = state.getHTMLTemplate(tokens, data);

      expect(template.holes).toEqual([{ type: PartType.Node, index: 2 }]);
      expect(template.element.innerHTML).toBe('<div>Hello, !</div>');
    });

    it('should get a HTML template from cache if avaiable', () => {
      const state = new RenderState();
      const [tokens, data] = tmpl`<div>Hello, ${'World'}!</div>`;
      const template = state.getHTMLTemplate(tokens, data);

      expect(template).toBe(state.getHTMLTemplate(tokens, data));
    });
  });

  describe('.getSVGTemplate()', () => {
    it('should create a SVG template from tokens', () => {
      const state = new RenderState();
      const [tokens, data] = tmpl`<text>Hello, ${'World'}!</text>`;
      const template = state.getSVGTemplate(tokens, data);

      expect(template.holes).toEqual([{ type: PartType.Node, index: 2 }]);
      expect(template.element.innerHTML).toBe('<text>Hello, !</text>');
      expect(template.element.content.firstElementChild?.namespaceURI).toBe(
        'http://www.w3.org/2000/svg',
      );
    });

    it('should get a SVG template from cache if avaiable', () => {
      const state = new RenderState();
      const [tokens, data] = tmpl`<div>Hello, ${'World'}!</div>`;
      const template = state.getSVGTemplate(tokens, data);

      expect(template).toBe(state.getSVGTemplate(tokens, data));
    });
  });

  describe('.getScopedValue()', () => {
    it('should get a scoped value from shared variables', () => {
      const state = new RenderState([['foo', 123]]);
      const block = new MockBlock();

      expect(state.getScopedValue(block, 'foo')).toBe(123);
    });

    it('should get a scoped value from the block', () => {
      const state = new RenderState([['foo', 123]]);
      const block = new MockBlock();

      state.setScopedValue(block, 'foo', 456);

      expect(state.getScopedValue(block, 'foo')).toBe(456);

      state.setScopedValue(block, 'foo', 789);

      expect(state.getScopedValue(block, 'foo')).toBe(789);
    });

    it('should get a scoped value from the parent', () => {
      const state = new RenderState([['foo', 123]]);
      const parent = new MockBlock();
      const block = new MockBlock(parent);

      state.setScopedValue(parent, 'foo', 456);

      expect(state.getScopedValue(block, 'foo')).toBe(456);
    });
  });

  describe('.renderComponent()', () => {
    it('should return the component', () => {
      const state = new RenderState();
      const template = new MockTemplate();
      const props = {
        data: {},
      };
      const component = vi.fn().mockImplementation((props, context) => {
        context.useEffect(() => {});
        return { template, data: props.data };
      });
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const updater = new SyncUpdater(state);
      const result = state.renderComponent(
        component,
        props,
        hooks,
        block,
        updater,
      );

      expect(result.template).toBe(template);
      expect(result.data).toEqual(props.data);
      expect(component).toHaveBeenCalledOnce();
      expect(component).toHaveBeenCalledWith(props, expect.any(RenderContext));
      expect(hooks).toEqual([
        expect.objectContaining({ type: HookType.Effect }),
        { type: HookType.Finalizer },
      ]);
    });
  });
});

function tmpl(
  tokens: TemplateStringsArray,
  ...data: unknown[]
): [TemplateStringsArray, unknown[]] {
  return [tokens, data];
}
