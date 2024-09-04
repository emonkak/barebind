import { describe, expect, it, vi } from 'vitest';

import { UpdateContext } from '../../src/baseTypes.js';
import { LazyTemplateResult } from '../../src/directives/templateResult.js';
import { LazyTemplate } from '../../src/template/lazyTemplate.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import {
  MockBlock,
  MockRenderHost,
  MockTemplate,
  MockTemplateView,
} from '../mocks.js';

describe('LazyTemplate', () => {
  describe('.constructor()', () => {
    it('should construct a new LazyTemplate', () => {
      const templateFactory = () => new MockTemplate();
      const template = new LazyTemplate(templateFactory);
      expect(template.templateFactory).toBe(templateFactory);
    });
  });

  describe('.render()', () => {
    it('should render a template created by the template factory', () => {
      const host = new MockRenderHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const template = new MockTemplate();
      const lazyTemplate = new LazyTemplate(() => template);
      const data = [] as const;
      const view = new MockTemplateView(data);

      const renderSpy = vi.spyOn(template, 'render').mockReturnValue(view);

      expect(lazyTemplate.render(data, context)).toBe(view);
      expect(lazyTemplate.render(data, context)).toBe(view);
      expect(renderSpy).toHaveBeenCalledTimes(2);
      expect(renderSpy).toHaveBeenCalledWith(data, context);
    });
  });

  describe('.isSameTemplate()', () => {
    it('should return true if the instance is the same as this one', () => {
      const template = new LazyTemplate(() => new MockTemplate());

      expect(template.isSameTemplate(template)).toBe(true);
      expect(template.isSameTemplate(new MockTemplate())).toBe(false);
    });
  });

  describe('.wrapInResult()', () => {
    it('should wrap this template in LazyTemplateResult', () => {
      const template = new LazyTemplate(() => new MockTemplate());
      const data = ['foo'] as const;
      const result = template.wrapInResult(data);

      expect(result).toBeInstanceOf(LazyTemplateResult);
      expect(result.template).toBe(template);
      expect(result.data).toBe(data);
    });
  });
});
