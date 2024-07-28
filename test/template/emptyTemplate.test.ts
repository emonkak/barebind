import { describe, expect, it } from 'vitest';

import {
  EmptyTemplate,
  EmptyTemplateFragment,
} from '../../src/template/emptyTemplate.js';
import { PartType } from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockUpdateContext } from '../mocks.js';

describe('EmptyTemplate', () => {
  describe('.constructor()', () => {
    it('should be forbidden from being called directly', () => {
      expect(() => new (EmptyTemplate as any)()).toThrow(
        'EmptyTemplate constructor cannot be called directly.',
      );
    });
  });

  describe('.render()', () => {
    it('should return EmptyTemplateFragment', () => {
      const updater = new SyncUpdater(new MockUpdateContext());
      const fragment = EmptyTemplate.instance.render(null, updater);

      updater.flush();

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
  describe('.bind()', () => {
    it('should do nothing', () => {
      const fragment = new EmptyTemplateFragment();
      const updater = new SyncUpdater(new MockUpdateContext());

      fragment.bind(null, updater);

      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.unbind()', () => {
    it('should do nothing', () => {
      const fragment = new EmptyTemplateFragment();
      const updater = new SyncUpdater(new MockUpdateContext());

      fragment.unbind(updater);

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
