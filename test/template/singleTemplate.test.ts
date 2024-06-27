import { describe, expect, it, vi } from 'vitest';

import { NodeBinding } from '../../src/binding.js';
import {
  ChildNodeTemplate,
  SingleTemplateFragment,
  TextTemplate,
} from '../../src/template/singleTemplate.js';
import { PartType } from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockBinding, MockDirective, MockRenderingEngine } from '../mocks.js';

describe('ChildNodeTemplate', () => {
  describe('.constructor()', () => {
    it('should be forbidden from being called directly', () => {
      expect(() => new (ChildNodeTemplate as any)()).toThrow(
        'ChildNodeTemplate constructor cannot be called directly.',
      );
    });
  });

  describe('.hydrate()', () => {
    it('should hydrate SingleTemplateFragment initialized with NodeBinding', () => {
      const updater = new SyncUpdater(new MockRenderingEngine());
      const fragment = ChildNodeTemplate.instance.hydrate('foo', updater);

      updater.flush();

      expect(fragment.binding).toBeInstanceOf(NodeBinding);
      expect(fragment.binding.part).toMatchObject({
        type: PartType.ChildNode,
        node: expect.any(Comment),
      });
      expect(fragment.binding.part.node.nodeValue).toBe('foo');
    });

    it('should hydrate SingleTemplateFragment by a directive', () => {
      const updater = new SyncUpdater(new MockRenderingEngine());
      const directive = new MockDirective();
      const fragment = ChildNodeTemplate.instance.hydrate(directive, updater);

      expect(fragment.binding).toBeInstanceOf(MockBinding);
      expect(fragment.binding.value).toBe(directive);
      expect(fragment.binding.part).toMatchObject({
        type: PartType.ChildNode,
        node: expect.any(Comment),
      });
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
    it('should be forbidden from being called directly', () => {
      expect(() => new (TextTemplate as any)()).toThrow(
        'TextTemplate constructor cannot be called directly.',
      );
    });
  });

  describe('.hydrate()', () => {
    it('should hydrate SingleTemplateFragment initialized with NodeBinding', () => {
      const updater = new SyncUpdater(new MockRenderingEngine());
      const fragment = TextTemplate.instance.hydrate('foo', updater);

      updater.flush();

      expect(fragment.binding).toBeInstanceOf(NodeBinding);
      expect(fragment.binding.value).toBe('foo');
      expect(fragment.binding.part).toMatchObject({
        type: PartType.Node,
        node: expect.any(Text),
      });
      expect(fragment.binding.part.node.nodeValue).toBe('foo');
    });

    it('should hydrate SingleTemplateFragment by a directive', () => {
      const updater = new SyncUpdater(new MockRenderingEngine());
      const directive = new MockDirective();
      const fragment = TextTemplate.instance.hydrate(directive, updater);

      expect(fragment.binding).toBeInstanceOf(MockBinding);
      expect(fragment.binding.value).toBe(directive);
      expect(fragment.binding.part).toMatchObject({
        type: PartType.Node,
        node: expect.any(Text),
      });
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
  describe('.constructor()', () => {
    it('should construct a new SingleTemplateFragment', () => {
      const binding = new NodeBinding('foo', {
        type: PartType.Node,
        node: document.createTextNode(''),
      });
      const fragment = new SingleTemplateFragment(binding);

      expect(fragment.binding).toBe(binding);
      expect(fragment.binding.value).toBe('foo');
      expect(fragment.startNode).toBe(binding.startNode);
      expect(fragment.endNode).toBe(binding.endNode);
    });
  });

  describe('.attach()', () => {
    it('should bind a value to the binding', () => {
      const binding = new NodeBinding('foo', {
        type: PartType.Node,
        node: document.createTextNode(''),
      });
      const fragment = new SingleTemplateFragment(binding);
      const updater = new SyncUpdater(new MockRenderingEngine());
      const bindSpy = vi.spyOn(binding, 'bind');

      fragment.attach('bar', updater);

      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith('bar', updater);
    });
  });

  describe('.detach()', () => {
    it('should unbind the value from the binding', () => {
      const binding = new NodeBinding('foo', {
        type: PartType.Node,
        node: document.createTextNode(''),
      });
      const fragment = new SingleTemplateFragment(binding);
      const updater = new SyncUpdater(new MockRenderingEngine());
      const unbindSpy = vi.spyOn(binding, 'unbind');

      fragment.detach(updater);

      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(updater);
    });
  });

  describe('.mount()', () => {
    it('should mount the binding before the part', () => {
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new NodeBinding('foo', {
        type: PartType.Node,
        node: document.createTextNode('foo'),
      });
      const fragment = new SingleTemplateFragment(binding);

      container.appendChild(part.node);
      fragment.mount(part);

      expect(container.innerHTML).toBe('foo<!---->');

      fragment.unmount(part);

      expect(container.innerHTML).toBe('<!---->');
    });
  });

  describe('.unmount()', () => {
    it('should do nothing if a different part from the one at mount is given', () => {
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new NodeBinding('foo', {
        type: PartType.Node,
        node: document.createTextNode('foo'),
      });
      const fragment = new SingleTemplateFragment(binding);

      container.appendChild(part.node);
      fragment.mount(part);

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
      const binding = new NodeBinding('foo', part);
      const fragment = new SingleTemplateFragment(binding);
      const disconnectSpy = vi.spyOn(binding, 'disconnect');

      fragment.disconnect();

      expect(disconnectSpy).toHaveBeenCalledOnce();
    });
  });
});
