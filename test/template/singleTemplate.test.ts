import { describe, expect, it, vi } from 'vitest';

import { NodeBinding } from '../../src/binding.js';
import {
  ChildNodeTemplate,
  SingleTemplateFragment,
  TextTemplate,
} from '../../src/template/singleTemplate.js';
import { PartType, createUpdateContext } from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockUpdateHost } from '../mocks.js';

describe('ChildNodeTemplate', () => {
  describe('.constructor()', () => {
    it('should throw an error from being called directly', () => {
      expect(() => new (ChildNodeTemplate as any)()).toThrow(
        'ChildNodeTemplate constructor cannot be called directly.',
      );
    });
  });

  describe('.render()', () => {
    it('should return a new SingleTemplateFragment', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const fragment = ChildNodeTemplate.instance.render('foo', context);

      updater.flushUpdate(host);

      expect(fragment.binding).toBeInstanceOf(NodeBinding);
      expect(fragment.binding.part).toMatchObject({
        type: PartType.ChildNode,
        node: expect.any(Comment),
      });
      expect(fragment.binding.part.node.nodeValue).toBe('foo');
      expect(fragment.startNode).toBe(fragment.binding.startNode);
      expect(fragment.endNode).toBe(fragment.binding.endNode);
    });
  });

  describe('.isSameTemplate()', () => {
    it('should return true always since the instance is a singleton', () => {
      expect(
        ChildNodeTemplate.instance.isSameTemplate(ChildNodeTemplate.instance),
      ).toBe(true);
    });
  });
});

describe('TextTemplate', () => {
  describe('.constructor()', () => {
    it('should throw an error from being called directly', () => {
      expect(() => new (TextTemplate as any)()).toThrow(
        'TextTemplate constructor cannot be called directly.',
      );
    });
  });

  describe('.render()', () => {
    it('should return SingleTemplateFragment', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const fragment = TextTemplate.instance.render('foo', context);

      expect(fragment.binding).toBeInstanceOf(NodeBinding);
      expect(fragment.binding.value).toBe('foo');
      expect(fragment.binding.part).toMatchObject({
        type: PartType.Node,
        node: expect.any(Text),
      });
      expect(fragment.startNode).toBe(fragment.binding.startNode);
      expect(fragment.endNode).toBe(fragment.binding.endNode);
    });
  });

  describe('.isSameTemplate', () => {
    it('should return true always since the instance is a singleton', () => {
      expect(TextTemplate.instance.isSameTemplate(TextTemplate.instance)).toBe(
        true,
      );
    });
  });
});

describe('SingleTemplateFragment', () => {
  describe('.connect()', () => {
    it('should bind values to element and child binding', () => {
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const fragment = new SingleTemplateFragment('foo', part, context);

      fragment.connect(context);
      updater.flushUpdate(host);

      expect(part.node.nodeValue).toBe('foo');

      fragment.bind('bar', context);
      updater.flushUpdate(host);

      expect(part.node.nodeValue).toBe('bar');

      fragment.unbind(context);
      updater.flushUpdate(host);

      expect(part.node.nodeValue).toBe('');
    });
  });

  describe('.mount()', () => {
    it('should mount the node before the part node', () => {
      const fragmentPart = {
        type: PartType.Node,
        node: document.createTextNode('foo'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const fragment = new SingleTemplateFragment('foo', fragmentPart, context);
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;

      container.appendChild(part.node);
      fragment.connect(context);
      updater.flushUpdate(host);

      expect(container.innerHTML).toBe('<!---->');

      fragment.mount(part);

      expect(container.innerHTML).toBe('foo<!---->');

      fragment.unmount(part);

      expect(container.innerHTML).toBe('<!---->');
    });
  });

  describe('.unmount()', () => {
    it('should not remove the node if a different part is given', () => {
      const fragmentPart = {
        type: PartType.Node,
        node: document.createTextNode('foo'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const fragment = new SingleTemplateFragment('foo', fragmentPart, context);
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;

      container.appendChild(part.node);

      expect(container.innerHTML).toBe('<!---->');

      fragment.mount(part);
      updater.flushUpdate(host);

      expect(container.innerHTML).toBe('foo<!---->');

      fragment.unmount({
        type: PartType.ChildNode,
        node: document.createComment(''),
      });

      expect(container.innerHTML).toBe('foo<!---->');
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect from the binding', () => {
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const fragment = new SingleTemplateFragment('foo', part, context);
      const disconnectSpy = vi.spyOn(fragment.binding, 'disconnect');

      fragment.disconnect();

      expect(disconnectSpy).toHaveBeenCalledOnce();
    });
  });
});
