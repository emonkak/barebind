import { describe, expect, it, vi } from 'vitest';

import { NodeBinding, directiveTag } from '../../src/binding.js';
import {
  ChoiceBinding,
  ChoiceDirective,
  choice,
} from '../../src/directives/choice.js';
import { PartType } from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockBinding, MockDirective, MockRenderingEngine } from '../mocks.js';

describe('choice()', () => {
  it('should construct a new ChoiceDirective', () => {
    const key = 'foo';
    const factory = () => new MockDirective();
    const directive = choice(key, factory);

    expect(directive.key).toBe(key);
    expect(directive.factory).toBe(factory);
  });
});

describe('ChoiceDirective', () => {
  describe('[directiveTag]()', () => {
    it('should return an instance of ChoiceDirective from a non-directive value', () => {
      const factory = vi.fn((key: 'foo' | 'bar') => key);
      const directive = choice('foo', factory);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
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
      expect(binding.binding.value).toBe('foo');
      expect(factory).toHaveBeenCalledOnce();
      expect(factory).toHaveBeenCalledWith('foo');
      expect(getPartSpy).toHaveBeenCalledOnce();
      expect(getStartNodeSpy).toHaveBeenCalledOnce();
      expect(getEndNodeSpy).toHaveBeenCalledOnce();
    });

    it('should return an instance of ChoiceDirective from a directive', () => {
      const fooDirective = new MockDirective();
      const barDirective = new MockDirective();
      const factory = vi.fn((key: 'foo' | 'bar') => {
        switch (key) {
          case 'foo':
            return fooDirective;
          case 'bar':
            return barDirective;
        }
      });
      const directive = choice('foo', factory);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
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
      expect(binding.binding.value).toBe(fooDirective);
      expect(factory).toHaveBeenCalledOnce();
      expect(factory).toHaveBeenCalledWith('foo');
      expect(getPartSpy).toHaveBeenCalledOnce();
      expect(getStartNodeSpy).toHaveBeenCalledOnce();
      expect(getEndNodeSpy).toHaveBeenCalledOnce();
    });
  });
});

describe('ChoiceBinding', () => {
  describe('.connect()', () => {
    it('should delegate to the current binding', () => {
      const directive = choice('foo', () => new MockDirective());
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockRenderingEngine());
      const binding = new ChoiceBinding(directive, part, updater);
      const connectSpy = vi.spyOn(binding.binding, 'connect');

      binding.connect(updater);
      updater.flush();

      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(updater);
    });
  });

  describe('.bind()', () => {
    it('should bind the new value to the current binding if the key is the same', () => {
      const fooDirective = new MockDirective();
      const barDirective = new MockDirective();
      const fooDirectiveSpy = vi.spyOn(fooDirective, directiveTag);
      const barDirectiveSpy = vi.spyOn(barDirective, directiveTag);
      const factory = vi.fn((key: 'foo' | 'bar') => {
        switch (key) {
          case 'foo':
            return fooDirective;
          case 'bar':
            return barDirective;
        }
      });
      const directive = new ChoiceDirective<'foo' | 'bar', MockDirective>(
        'foo',
        factory,
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockRenderingEngine());
      const binding = new ChoiceBinding(directive, part, updater);
      const bindSpy = vi.spyOn(binding.binding, 'bind');

      binding.connect(updater);
      updater.flush();

      binding.bind(directive, updater);
      updater.flush();

      expect(binding.binding.value).toBe(fooDirective);
      expect(fooDirectiveSpy).toHaveBeenCalledOnce();
      expect(barDirectiveSpy).not.toHaveBeenCalled();
      expect(factory).toHaveBeenCalledTimes(2);
      expect(factory).toHaveBeenNthCalledWith(1, 'foo');
      expect(factory).toHaveBeenNthCalledWith(2, 'foo');
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(barDirective, updater);
    });

    it('should connect a new binding and unbind the old binidng if the key changes', () => {
      const fooDirective = new MockDirective();
      const barDirective = new MockDirective();
      const fooDirectiveSpy = vi.spyOn(fooDirective, directiveTag);
      const barDirectiveSpy = vi.spyOn(barDirective, directiveTag);
      const factory = vi.fn((key: 'foo' | 'bar') => {
        switch (key) {
          case 'foo':
            return fooDirective;
          case 'bar':
            return barDirective;
        }
      });
      const directive1 = new ChoiceDirective<'foo' | 'bar', MockDirective>(
        'foo',
        factory,
      );
      const directive2 = new ChoiceDirective<'foo' | 'bar', MockDirective>(
        'bar',
        factory,
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockRenderingEngine());
      const binding = new ChoiceBinding(directive1, part, updater);
      const bindSpy = vi.spyOn(binding.binding, 'bind');
      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.connect(updater);
      updater.flush();

      binding.bind(directive2, updater);
      updater.flush();

      expect(binding.binding.value).toBe(barDirective);
      expect(fooDirectiveSpy).toHaveBeenCalledOnce();
      expect(barDirectiveSpy).toHaveBeenCalledOnce();
      expect(factory).toHaveBeenCalledTimes(2);
      expect(factory).toHaveBeenNthCalledWith(1, 'foo');
      expect(factory).toHaveBeenNthCalledWith(2, 'bar');
      expect(bindSpy).not.toHaveBeenCalled();
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(updater);
    });

    it('should memoize the old binding if the key changes', () => {
      const fooDirective = new MockDirective();
      const barDirective = new MockDirective();
      const fooDirectiveSpy = vi.spyOn(fooDirective, directiveTag);
      const barDirectiveSpy = vi.spyOn(barDirective, directiveTag);
      const factory = vi.fn((key: 'foo' | 'bar') => {
        switch (key) {
          case 'foo':
            return fooDirective;
          case 'bar':
            return barDirective;
        }
      });
      const directive1 = new ChoiceDirective<'foo' | 'bar', MockDirective>(
        'foo',
        factory,
      );
      const directive2 = new ChoiceDirective<'foo' | 'bar', MockDirective>(
        'bar',
        factory,
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockRenderingEngine());
      const binding = new ChoiceBinding(directive1, part, updater);
      const bindSpy = vi.spyOn(binding.binding, 'bind');
      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.connect(updater);
      updater.flush();

      binding.bind(directive2, updater);
      updater.flush();

      binding.bind(directive1, updater);
      updater.flush();

      expect(binding.binding.value).toBe(fooDirective);
      expect(fooDirectiveSpy).toHaveBeenCalledOnce();
      expect(barDirectiveSpy).toHaveBeenCalledOnce();
      expect(factory).toHaveBeenCalledTimes(3);
      expect(factory).toHaveBeenNthCalledWith(1, 'foo');
      expect(factory).toHaveBeenNthCalledWith(2, 'bar');
      expect(factory).toHaveBeenNthCalledWith(3, 'foo');
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(updater);
    });

    it('should throw an error if the new value is not ChoiceDirective', () => {
      const directive = choice('foo', () => new MockDirective());
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockRenderingEngine());
      const binding = new ChoiceBinding(directive, part, updater);

      expect(() => {
        binding.bind(null as any, updater);
      }).toThrow(
        'A value must be a instance of "ChoiceDirective", but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should delegate to the current binding', () => {
      const directive = choice('foo', () => new MockDirective());
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockRenderingEngine());
      const binding = new ChoiceBinding(directive, part, updater);
      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.unbind(updater);

      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(updater);
    });
  });

  describe('.disconnect()', () => {
    it('should delegate to the current binding', () => {
      const directive = choice('foo', () => new MockDirective());
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockRenderingEngine());
      const binding = new ChoiceBinding(directive, part, updater);
      const disconnectSpy = vi.spyOn(binding.binding, 'disconnect');

      binding.disconnect();

      expect(disconnectSpy).toHaveBeenCalledOnce();
    });
  });
});
