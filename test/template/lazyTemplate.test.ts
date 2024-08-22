import { describe, expect, it } from 'vitest';

import { UpdateContext } from '../../src/baseTypes.js';
import { LazyTemplate } from '../../src/template/lazyTemplate.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import {
  MockBlock,
  MockTemplate,
  MockTemplateView,
  MockUpdateHost,
} from '../mocks.js';

describe('LazyTemplate', () => {
  describe('.constructor()', () => {
    it('should construct a new LazyTemplate', () => {
      const templateFactory = () => new MockTemplate();
      const key = {};
      const template = new LazyTemplate(templateFactory, key);
      expect(template.templateFactory).toBe(templateFactory);
      expect(template.key).toBe(key);
    });
  });

  describe('.render()', () => {
    it('should render a template created by the template factory', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const view = new LazyTemplate(() => new MockTemplate(), {}).render(
        null,
        context,
      );

      expect(view).toBeInstanceOf(MockTemplateView);
      expect(view.startNode).toBe(null);
      expect(view.endNode).toBe(null);
    });
  });

  describe('.isSameTemplate', () => {
    it('should return true if keys match', () => {
      const templateFactory = () => new MockTemplate();
      const key1 = 'foo';
      const key2 = 'bar';
      expect(
        new LazyTemplate(templateFactory, key1).isSameTemplate(
          new LazyTemplate(templateFactory, key1),
        ),
      ).toBe(true);
      expect(
        new LazyTemplate(templateFactory, key1).isSameTemplate(
          new LazyTemplate(templateFactory, key2),
        ),
      ).toBe(false);
      expect(
        new LazyTemplate(templateFactory, key1).isSameTemplate(
          new MockTemplate(),
        ),
      ).toBe(false);
    });
  });
});
