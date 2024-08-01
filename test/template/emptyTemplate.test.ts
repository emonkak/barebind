import { describe, expect, it } from 'vitest';

import {
  EmptyTemplate,
  EmptyTemplateFragment,
} from '../../src/template/emptyTemplate.js';
import { PartType } from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockUpdateHost } from '../mocks.js';

describe('EmptyTemplate', () => {
  describe('.constructor()', () => {
    it('should throw an error from being called directly', () => {
      expect(() => new (EmptyTemplate as any)()).toThrow(
        'EmptyTemplate constructor cannot be called directly.',
      );
    });
  });

  describe('.render()', () => {
    it('should return a new EmptyTemplateFragment', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };
      const fragment = EmptyTemplate.instance.render(null, context);

      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
      expect(fragment.startNode).toBe(null);
      expect(fragment.endNode).toBe(null);
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

describe('EmptyTemplateFragment', () => {
  describe('.connect()', () => {
    it('should do nothing', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };
      const fragment = new EmptyTemplateFragment();

      fragment.connect(context);

      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.bind()', () => {
    it('should do nothing', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };
      const fragment = new EmptyTemplateFragment();

      fragment.bind(null, context);

      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.unbind()', () => {
    it('should do nothing', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };
      const fragment = new EmptyTemplateFragment();

      fragment.unbind(context);

      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.mount()', () => {
    it('should do nothing', () => {
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const fragment = new EmptyTemplateFragment();

      container.appendChild(part.node);

      expect(container.innerHTML).toBe('<!---->');

      fragment.mount(part);

      expect(container.innerHTML).toBe('<!---->');

      fragment.unmount(part);

      expect(container.innerHTML).toBe('<!---->');
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const fragment = new EmptyTemplateFragment();

      fragment.disconnect();
    });
  });
});
