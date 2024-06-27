import { describe, expect, it, vi } from 'vitest';

import { NodeBinding, directiveTag } from '../../src/binding.js';
import { DynamicBinding, dynamic } from '../../src/directives/dynamic.js';
import { PartType } from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockBinding, MockDirective, MockRenderingEngine } from '../mocks.js';

describe('dynamic()', () => {
  it('should construct a new DynamicDirective', () => {
    const directive = dynamic('foo');

    expect(directive.value).toBe('foo');
  });
});

describe('DynamicDirective', () => {
  describe('[directiveTag]()', () => {
    it('should return an instance of DynamicBinding from the non-directive value', () => {
      const directive = dynamic('foo');
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const updater = new SyncUpdater(new MockRenderingEngine());
      const binding = directive[directiveTag](part, updater);
      const getPartSpy = vi.spyOn(binding.binding, 'part', 'get');
      const getStartNodeSpy = vi.spyOn(binding.binding, 'startNode', 'get');
      const getEndNodeSpy = vi.spyOn(binding.binding, 'endNode', 'get');

      expect(binding.value).toBe(directive);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.binding).toBeInstanceOf(NodeBinding);
      expect(getPartSpy).toHaveBeenCalledOnce();
      expect(getStartNodeSpy).toHaveBeenCalledOnce();
      expect(getEndNodeSpy).toHaveBeenCalledOnce();
    });

    it('should return an instance of DynamicBinding from the directive', () => {
      const directive = dynamic(new MockDirective());
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const updater = new SyncUpdater(new MockRenderingEngine());
      const binding = directive[directiveTag](part, updater);
      const getPartSpy = vi.spyOn(binding.binding, 'part', 'get');
      const getStartNodeSpy = vi.spyOn(binding.binding, 'startNode', 'get');
      const getEndNodeSpy = vi.spyOn(binding.binding, 'endNode', 'get');

      expect(binding.value).toBe(directive);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.binding).toBeInstanceOf(MockBinding);
      expect(getPartSpy).toHaveBeenCalledOnce();
      expect(getStartNodeSpy).toHaveBeenCalledOnce();
      expect(getEndNodeSpy).toHaveBeenCalledOnce();
    });
  });
});

describe('DynamicBinding', () => {
  describe('.connect()', () => {
    it('should delegate to the current binding', () => {
      const directive = dynamic('foo');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockRenderingEngine());
      const binding = new DynamicBinding(directive, part, updater);
      const connectSpy = vi.spyOn(binding.binding, 'connect');

      binding.connect(updater);

      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(updater);
    });
  });

  describe('.bind()', () => {
    it('should bind a new value to the current binding if old and new values are non-directive', () => {
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const updater = new SyncUpdater(new MockRenderingEngine());
      const binding = new DynamicBinding(dynamic('foo'), part, updater);
      const bindSpy = vi.spyOn(binding.binding, 'bind');
      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.connect(updater);
      updater.flush();

      binding.bind(dynamic('bar'), updater);
      updater.flush();

      expect(part.node.nodeValue).toBe('bar');
      expect(binding.binding).toBeInstanceOf(NodeBinding);
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).not.toHaveBeenCalled();
    });

    it('should bind a new value to the current binding if old and new values are the same directive', () => {
      const directive = new MockDirective();
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const updater = new SyncUpdater(new MockRenderingEngine());
      const binding = new DynamicBinding(
        dynamic(new MockDirective()),
        part,
        updater,
      );
      const bindSpy = vi.spyOn(binding.binding, 'bind');
      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.connect(updater);
      updater.flush();

      binding.bind(dynamic(new MockDirective()), updater);
      updater.flush();

      expect(binding.binding).toBeInstanceOf(MockBinding);
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(directive, updater);
      expect(unbindSpy).not.toHaveBeenCalled();
    });

    it('should unbind the old binding and connect a new binding if old and new values are directive and non-directive', () => {
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const updater = new SyncUpdater(new MockRenderingEngine());
      const binding = new DynamicBinding(
        dynamic(new MockDirective()),
        part,
        updater,
      );
      const bindSpy = vi.spyOn(binding.binding, 'bind');
      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.connect(updater);
      updater.flush();

      binding.bind(dynamic('foo'), updater);
      updater.flush();

      expect(part.node.nodeValue).toBe('foo');
      expect(binding.binding).toBeInstanceOf(NodeBinding);
      expect(bindSpy).not.toHaveBeenCalled();
      expect(unbindSpy).toHaveBeenCalled();
    });

    it('should unbind the old binding and connect a new binding if old and new values are non-directive and directive', () => {
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const updater = new SyncUpdater(new MockRenderingEngine());
      const binding = new DynamicBinding(dynamic('foo'), part, updater);
      const bindSpy = vi.spyOn(binding.binding, 'bind');
      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.connect(updater);
      updater.flush();

      let isConnected = false;
      const directive = new MockDirective();

      vi.spyOn(directive, directiveTag).mockImplementation((part) => {
        const binding = new MockBinding(directive, part);
        vi.spyOn(binding, 'connect').mockImplementation(() => {
          isConnected = true;
        });
        return binding;
      });

      binding.bind(dynamic(directive), updater);
      updater.flush();

      expect(isConnected).toBe(true);
      expect(binding.binding).toBeInstanceOf(MockBinding);
      expect(bindSpy).not.toHaveBeenCalled();
      expect(unbindSpy).toHaveBeenCalled();
    });
  });

  describe('.unbind()', () => {
    it('should delegate to the current binding', () => {
      const directive = dynamic('foo');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockRenderingEngine());
      const binding = new DynamicBinding(directive, part, updater);
      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.unbind(updater);

      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(updater);
    });
  });

  describe('.disconnect()', () => {
    it('should delegate to the current binding', () => {
      const directive = dynamic('foo');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockRenderingEngine());
      const binding = new DynamicBinding(directive, part, updater);
      const disconnectSpy = vi.spyOn(binding.binding, 'disconnect');

      binding.disconnect();

      expect(disconnectSpy).toHaveBeenCalledOnce();
    });
  });
});
