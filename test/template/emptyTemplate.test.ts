import { describe, expect, it } from 'vitest';

import { PartType, UpdateContext } from '../../src/baseTypes.js';
import {
  EmptyTemplate,
  EmptyTemplateView,
} from '../../src/templates/emptyTemplate.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockBlock, MockUpdateHost } from '../mocks.js';

describe('EmptyTemplate', () => {
  describe('.constructor()', () => {
    it('should throw an error from being called directly', () => {
      expect(() => new (EmptyTemplate as any)()).toThrow(
        'EmptyTemplate constructor cannot be called directly.',
      );
    });
  });

  describe('.render()', () => {
    it('should return a new EmptyTemplateView', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const view = EmptyTemplate.instance.render(null, context);

      expect(view).toBeInstanceOf(EmptyTemplateView);
      expect(view.startNode).toBe(null);
      expect(view.endNode).toBe(null);
    });
  });

  describe('.isSameTemplate', () => {
    it('should return true always since the instance is a singleton', () => {
      expect(
        EmptyTemplate.instance.isSameTemplate(EmptyTemplate.instance),
      ).toBe(true);
    });
  });
});

describe('EmptyTemplateView', () => {
  describe('.connect()', () => {
    it('should do nothing', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const view = new EmptyTemplateView();

      view.connect(context);

      expect(context.isPending()).toBe(false);
    });
  });

  describe('.bind()', () => {
    it('should do nothing', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const view = new EmptyTemplateView();

      view.bind(null, context);

      expect(context.isPending()).toBe(false);
    });
  });

  describe('.unbind()', () => {
    it('should do nothing', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const view = new EmptyTemplateView();

      view.unbind(context);

      expect(context.isPending()).toBe(false);
    });
  });

  describe('.mount()', () => {
    it('should do nothing', () => {
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;

      const view = new EmptyTemplateView();

      container.appendChild(part.node);

      expect(container.innerHTML).toBe('<!---->');

      view.mount(part);

      expect(container.innerHTML).toBe('<!---->');

      view.unmount(part);

      expect(container.innerHTML).toBe('<!---->');
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const view = new EmptyTemplateView();

      view.disconnect();
    });
  });
});
