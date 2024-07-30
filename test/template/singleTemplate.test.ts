import { describe, expect, it, vi } from 'vitest';

import { NodeBinding } from '../../src/binding.js';
import {
  ChildNodeTemplate,
  SingleTemplateFragment,
  TextTemplate,
} from '../../src/template/singleTemplate.js';
import { PartType, createUpdateContext } from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockUpdateHost, TextBinding, TextDirective } from '../mocks.js';

describe('ChildNodeTemplate', () => {
  describe('.constructor()', () => {
    it('should be forbidden from being called directly', () => {
      expect(() => new (ChildNodeTemplate as any)()).toThrow(
        'ChildNodeTemplate constructor cannot be called directly.',
      );
    });
  });

  describe('.render()', () => {
    it('should return SingleTemplateFragment initialized with a non-directive value', () => {
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
    });

    it('should return SingleTemplateFragment by a directive', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const directive = new TextDirective();
      const fragment = ChildNodeTemplate.instance.render(directive, context);

      expect(fragment.binding).toBeInstanceOf(TextBinding);
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

  describe('.render()', () => {
    it('should return SingleTemplateFragment initialized with NodeBinding', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const fragment = TextTemplate.instance.render('foo', context);

      updater.flushUpdate(host);

      expect(fragment.binding).toBeInstanceOf(NodeBinding);
      expect(fragment.binding.value).toBe('foo');
      expect(fragment.binding.part).toMatchObject({
        type: PartType.Node,
        node: expect.any(Text),
      });
      expect(fragment.binding.part.node.nodeValue).toBe('foo');
    });

    it('should return SingleTemplateFragment by a directive', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const directive = new TextDirective();
      const fragment = TextTemplate.instance.render(directive, context);

      expect(fragment.binding).toBeInstanceOf(TextBinding);
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

  describe('.bind()', () => {
    it('should bind a value to the binding', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new NodeBinding('foo', {
        type: PartType.Node,
        node: document.createTextNode(''),
      });
      const fragment = new SingleTemplateFragment(binding);
      const bindSpy = vi.spyOn(binding, 'bind');

      fragment.bind('bar', context);

      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith('bar', context);
    });
  });

  describe('.unbind()', () => {
    it('should unbind the value from the binding', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new NodeBinding('foo', {
        type: PartType.Node,
        node: document.createTextNode(''),
      });
      const fragment = new SingleTemplateFragment(binding);
      const unbindSpy = vi.spyOn(binding, 'unbind');

      fragment.unbind(context);

      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
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
