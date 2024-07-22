import { describe, expect, it, vi } from 'vitest';

import { NodeBinding } from '../../src/binding.js';
import { MemoBinding, memo } from '../../src/directives/memo.js';
import { PartType, directiveTag, nameTag } from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockBinding, MockDirective, MockUpdateContext } from '../mocks.js';

describe('memo()', () => {
  it('should construct a new Memo', () => {
    const factory = () => new MockDirective();
    const dependencies = ['foo'];
    const directive = memo(factory, dependencies);

    expect(directive.factory).toBe(factory);
    expect(directive.dependencies).toBe(dependencies);
  });
});

describe('Memo', () => {
  describe('[nameTag]', () => {
    it('should return a string represented itself', () => {
      expect(memo(() => 'foo', [])[nameTag]).toBe('Memo(foo)');
    });
  });

  describe('[directiveTag]()', () => {
    it('should return an instance of MemoBinding from the non-directive value', () => {
      const factory = vi.fn(() => 'foo');
      const directive = memo(factory, ['foo']);
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const updater = new SyncUpdater(new MockUpdateContext());
      const binding = directive[directiveTag](part, updater);
      const getPartSpy = vi.spyOn(binding.binding, 'part', 'get');
      const getStartNodeSpy = vi.spyOn(binding.binding, 'startNode', 'get');
      const getEndNodeSpy = vi.spyOn(binding.binding, 'endNode', 'get');

      expect(factory).toHaveBeenCalledOnce();
      expect(binding.value).toBe(directive);
      expect(binding.part).toBe(part);
      expect(binding.binding).toBeInstanceOf(NodeBinding);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(getPartSpy).toHaveBeenCalledOnce();
      expect(getStartNodeSpy).toHaveBeenCalledOnce();
      expect(getEndNodeSpy).toHaveBeenCalledOnce();
    });

    it('should return an instance of MemoBinding from the directive', () => {
      const factory = vi.fn(() => new MockDirective());
      const directive = memo(factory, ['foo']);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockUpdateContext());
      const binding = directive[directiveTag](part, updater);
      const getPartSpy = vi.spyOn(binding.binding, 'part', 'get');
      const getStartNodeSpy = vi.spyOn(binding.binding, 'startNode', 'get');
      const getEndNodeSpy = vi.spyOn(binding.binding, 'endNode', 'get');

      expect(factory).toHaveBeenCalledOnce();
      expect(binding.value).toBe(directive);
      expect(binding.part).toBe(part);
      expect(binding.binding).toBeInstanceOf(MockBinding);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(getPartSpy).toHaveBeenCalledOnce();
      expect(getStartNodeSpy).toHaveBeenCalledOnce();
      expect(getEndNodeSpy).toHaveBeenCalledOnce();
    });
  });
});

describe('MemoBinding', () => {
  describe('.connect()', () => {
    it('should delegate to the inner binding', () => {
      const directive = memo(() => new MockDirective(), ['foo']);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockUpdateContext());
      const binding = new MemoBinding(directive, part, updater);
      const connectSpy = vi.spyOn(binding.binding, 'connect');

      binding.connect(updater);

      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(updater);
    });
  });

  describe('.bind()', () => {
    it('should delete to the inner binding if dependencies are changed', () => {
      const directive1 = memo(() => new MockDirective(), ['foo']);
      const directive2 = memo(() => new MockDirective(), ['bar']);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockUpdateContext());
      const binding = new MemoBinding(directive1, part, updater);
      const bindSpy = vi.spyOn(binding.binding, 'bind');

      binding.connect(updater);
      updater.flush();

      binding.bind(directive2, updater);
      updater.flush();

      expect(binding.value).toBe(directive2);
      expect(bindSpy).toHaveBeenCalledOnce();
    });

    it('should skip an update if dependencies are not changed', () => {
      const directive1 = memo(() => new MockDirective(), ['foo']);
      const directive2 = memo(directive1.factory, directive1.dependencies);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockUpdateContext());
      const binding = new MemoBinding(directive1, part, updater);
      const bindSpy = vi.spyOn(binding.binding, 'bind');

      binding.connect(updater);
      updater.flush();

      binding.bind(directive2, updater);
      updater.flush();

      expect(binding.value).toBe(directive1);
      expect(bindSpy).not.toHaveBeenCalled();
    });

    it('should throw an error if the new value is not Memo directive', () => {
      const directive = memo(() => new MockDirective(), ['foo']);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockUpdateContext());
      const binding = new MemoBinding(directive, part, updater);

      expect(() => {
        binding.bind(null as any, updater);
      }).toThrow(
        'A value must be a instance of Memo directive, but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should delegate to the inner binding', () => {
      const directive = memo(() => new MockDirective(), ['foo']);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockUpdateContext());
      const binding = new MemoBinding(directive, part, updater);
      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.unbind(updater);

      expect(binding.value.dependencies).toBe(undefined);
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(updater);
    });
  });

  describe('.disconnect()', () => {
    it('should delegate to the inner binding', () => {
      const directive = memo(() => new MockDirective(), ['foo']);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockUpdateContext());
      const binding = new MemoBinding(directive, part, updater);
      const disconnectSpy = vi.spyOn(binding.binding, 'disconnect');

      binding.disconnect();

      expect(binding.value.dependencies).toBe(undefined);
      expect(disconnectSpy).toHaveBeenCalledOnce();
    });
  });
});
