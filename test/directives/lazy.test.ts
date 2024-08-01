import { describe, expect, it, vi } from 'vitest';

import { LazyBinding, lazy } from '../../src/directives/lazy.js';
import {
  PartType,
  createUpdateContext,
  directiveTag,
  nameTag,
} from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import {
  MockBlock,
  MockUpdateHost,
  TextBinding,
  TextDirective,
} from '../mocks.js';

describe('root()', () => {
  it('should construct a new Root directive', () => {
    const innerValue = new TextDirective('foo');
    const value = lazy(innerValue);

    expect(value.value).toBe(innerValue);
    expect(value.valueOf()).toBe(innerValue);
  });
});

describe('Lazy', () => {
  describe('[nameTag]', () => {
    it('should return a string represented itself', () => {
      expect(lazy('foo')[nameTag]).toBe('Lazy("foo")');
      expect(lazy(new TextDirective('foo'))[nameTag]).toBe(
        'Lazy(TextDirective)',
      );
    });
  });

  describe('[directiveTag]()', () => {
    it('should return a new LazyBinding', () => {
      const value = lazy(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const parent = new MockBlock();
      const context = createUpdateContext(host, updater, parent);
      const block = value[directiveTag](part, context);

      expect(block.value).toBe(value);
      expect(block.part).toBe(part);
      expect(block.startNode).toBe(part.node);
      expect(block.endNode).toBe(part.node);
      expect(block.parent).toBe(parent);
      expect(block.priority).toBe('user-blocking');
      expect(block.isConnected).toBe(false);
      expect(block.isUpdating).toBe(false);
      expect(block.binding).toBeInstanceOf(TextBinding);
      expect(block.binding.value).toBe(value.value);
    });
  });
});

describe('LazyBinding', () => {
  describe('.shouldUpdate()', () => {
    it('should return false after the block is initialized', () => {
      const value = lazy(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new LazyBinding(value, part, context);

      expect(binding.shouldUpdate()).toBe(false);
    });

    it('should return true after the block is connected', () => {
      const value = lazy(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new LazyBinding(value, part, context);

      binding.connect(context);

      expect(binding.shouldUpdate()).toBe(true);
    });

    it('should return true after an update is requested', () => {
      const value = lazy(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new LazyBinding(value, part, context);

      binding.connect(context);
      updater.flushUpdate(host);

      binding.requestUpdate('user-blocking', host, updater);

      expect(binding.shouldUpdate()).toBe(true);
    });

    it('should return false after the block is unbound', () => {
      const value = lazy(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new LazyBinding(value, part, context);

      binding.connect(context);
      binding.unbind(context);

      expect(binding.shouldUpdate()).toBe(false);
    });

    it('should return false if there is a parent is updating', () => {
      const value = lazy(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const parent = new MockBlock();
      const context = createUpdateContext(host, updater, parent);
      const binding = new LazyBinding(value, part, context);

      vi.spyOn(parent, 'isUpdating', 'get').mockReturnValue(true);

      binding.connect(context);

      expect(binding.shouldUpdate()).toBe(false);
    });
  });

  describe('.cancelUpdate()', () => {
    it('should cancel the update if it is scheduled', () => {
      const value = lazy(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new LazyBinding(value, part, context);

      binding.connect(context);
      binding.cancelUpdate();

      expect(binding.isUpdating).toBe(false);
    });
  });

  describe('.requestUpdate()', () => {
    it('should schedule an update with the user-specified priority', () => {
      const value = lazy(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new LazyBinding(value, part, context);

      binding.connect(context);
      updater.flushUpdate(host);

      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      binding.requestUpdate('background', host, updater);

      expect(binding.isUpdating).toBe(true);
      expect(binding.priority).toBe('background');
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(binding);
      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
    });

    it('should reschedule an update a higer priority', () => {
      const value = lazy(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new LazyBinding(value, part, context);

      binding.connect(context);
      updater.flushUpdate(host);

      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      binding.requestUpdate('background', host, updater);
      binding.requestUpdate('user-visible', host, updater);

      expect(binding.isUpdating).toBe(true);
      expect(binding.priority).toBe('user-visible');
      expect(enqueueBlockSpy).toHaveBeenCalledTimes(2);
      expect(enqueueBlockSpy).toHaveBeenCalledWith(binding);
      expect(scheduleUpdateSpy).toHaveBeenCalledTimes(2);
    });

    it('should not schedule an update with a lower or equal priority', () => {
      const value = lazy(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new LazyBinding(value, part, context);

      binding.connect(context);
      updater.flushUpdate(host);

      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      binding.requestUpdate('user-blocking', host, updater);
      binding.requestUpdate('user-visible', host, updater);

      expect(binding.isUpdating).toBe(true);
      expect(binding.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).toHaveBeenCalledTimes(1);
      expect(enqueueBlockSpy).toHaveBeenCalledWith(binding);
      expect(scheduleUpdateSpy).toHaveBeenCalledTimes(1);
    });

    it('should not schedule an update if the block is not connected', () => {
      const value = lazy(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new LazyBinding(value, part, context);

      binding.connect(context);
      updater.flushUpdate(host);

      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      binding.requestUpdate('background', host, updater);
      binding.requestUpdate('background', host, updater);

      expect(binding.isUpdating).toBe(true);
      expect(binding.priority).toBe('background');
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(binding);
      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
    });

    it('should not schedule an update if the block is already updating', () => {
      const value = lazy(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new LazyBinding(value, part, context);

      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      binding.requestUpdate('background', host, updater);

      expect(binding.isUpdating).toBe(false);
      expect(binding.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).not.toHaveBeenCalled();
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();
    });
  });

  describe('.connect()', () => {
    it('should enqueue the block for update with "user-blocking" priority', () => {
      const value = lazy(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new LazyBinding(value, part, context);

      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      binding.connect(context);

      expect(binding.isConnected).toBe(false);
      expect(binding.isUpdating).toBe(true);
      expect(binding.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(binding);
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();

      updater.flushUpdate(host);

      expect(binding.isConnected).toBe(true);
      expect(binding.isUpdating).toBe(false);
      expect(binding.priority).toBe('user-blocking');
    });

    it('should enqueue the block for update with the parent priority', () => {
      const value = lazy(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const parent = new MockBlock();
      const context = createUpdateContext(host, updater, parent);
      const binding = new LazyBinding(value, part, context);

      const getPrioritySpy = vi
        .spyOn(parent, 'priority', 'get')
        .mockReturnValue('background');
      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      binding.connect(context);

      expect(binding.isConnected).toBe(false);
      expect(binding.isUpdating).toBe(true);
      expect(binding.priority).toBe('background');
      expect(getPrioritySpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(binding);
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();

      updater.flushUpdate(host);

      expect(binding.isConnected).toBe(true);
      expect(binding.isUpdating).toBe(false);
      expect(binding.priority).toBe('background');
    });

    it('should re-enqueue the block with "user-blocking" priority', () => {
      const value = lazy(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new LazyBinding(value, part, context);

      binding.connect(context);
      updater.flushUpdate(host);

      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      binding.requestUpdate('background', host, updater);
      binding.connect(context);

      expect(binding.isConnected).toBe(true);
      expect(binding.isUpdating).toBe(true);
      expect(binding.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).toHaveBeenCalledTimes(2);
      expect(enqueueBlockSpy).toHaveBeenCalledWith(binding);
      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();

      updater.flushUpdate(host);

      expect(binding.isConnected).toBe(true);
      expect(binding.isUpdating).toBe(false);
      expect(binding.priority).toBe('user-blocking');
    });

    it('should not enqueue a block if it is already enqueueing', () => {
      const value = lazy(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new LazyBinding(value, part, context);

      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      binding.connect(context);
      binding.connect(context);

      expect(binding.isConnected).toBe(false);
      expect(binding.isUpdating).toBe(true);
      expect(binding.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(binding);
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();
    });

    it('should connect the binding on update', () => {
      const value = lazy(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new LazyBinding(value, part, context);

      const connectSpy = vi.spyOn(binding.binding, 'connect');

      binding.connect(context);
      expect(connectSpy).not.toHaveBeenCalled();

      updater.flushUpdate(host);
      expect(connectSpy).toHaveBeenCalledOnce();
    });
  });

  describe('.bind()', () => {
    it('should enqueue the block for update', () => {
      const value1 = lazy(new TextDirective('foo'));
      const value2 = lazy(new TextDirective('bar'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new LazyBinding(value1, part, context);

      binding.connect(context);
      updater.flushUpdate(host);

      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      binding.bind(value2, context);

      expect(binding.value).toBe(value2);
      expect(binding.isConnected).toBe(true);
      expect(binding.isUpdating).toBe(true);
      expect(binding.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(binding);
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();

      updater.flushUpdate(host);

      expect(binding.isConnected).toBe(true);
      expect(binding.isUpdating).toBe(false);
      expect(binding.priority).toBe('user-blocking');
    });

    it('should enqueue the block for update with the parent priority', () => {
      const value1 = lazy(new TextDirective('foo'));
      const value2 = lazy(new TextDirective('bar'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const parent = new MockBlock();
      const context = createUpdateContext(host, updater, parent);
      const binding = new LazyBinding(value1, part, context);

      binding.connect(context);
      updater.flushUpdate(host);

      const getPrioritySpy = vi
        .spyOn(parent, 'priority', 'get')
        .mockReturnValue('background');
      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      binding.bind(value2, context);

      expect(binding.value).toBe(value2);
      expect(binding.isConnected).toBe(true);
      expect(binding.isUpdating).toBe(true);
      expect(binding.priority).toBe('background');
      expect(getPrioritySpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(binding);
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();

      updater.flushUpdate(host);

      expect(binding.isConnected).toBe(true);
      expect(binding.isUpdating).toBe(false);
      expect(binding.priority).toBe('background');
    });

    it('should bind the new value to the binding on update', () => {
      const value1 = lazy(new TextDirective('foo'));
      const value2 = lazy(new TextDirective('bar'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new LazyBinding(value1, part, context);

      binding.connect(context);
      updater.flushUpdate(host);

      const bindSpy = vi.spyOn(binding.binding, 'bind');

      binding.bind(value2, context);
      expect(bindSpy).not.toHaveBeenCalled();

      updater.flushUpdate(host);
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(value2.value, {
        host,
        updater,
        currentBlock: binding,
      });
    });
  });

  describe('.unbind()', () => {
    it('should unbind the binding', () => {
      const value = lazy(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new LazyBinding(value, part, context);

      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.connect(context);
      updater.flushUpdate(host);

      expect(binding.isConnected).toBe(true);
      expect(binding.isUpdating).toBe(false);

      binding.unbind(context);

      expect(binding.isConnected).toBe(false);
      expect(binding.isUpdating).toBe(false);
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith({
        host,
        updater,
        currentBlock: binding,
      });
    });

    it('should cancel the update in progress', () => {
      const value = lazy(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new LazyBinding(value, part, context);

      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.connect(context);

      expect(binding.isConnected).toBe(false);
      expect(binding.isUpdating).toBe(true);

      binding.unbind(context);

      expect(binding.isConnected).toBe(false);
      expect(binding.isUpdating).toBe(false);
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith({
        host,
        updater,
        currentBlock: binding,
      });
    });
  });

  describe('.disconnect()', () => {
    it('should unbind the binding', () => {
      const value = lazy(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new LazyBinding(value, part, context);

      const disconnectSpy = vi.spyOn(binding, 'disconnect');

      binding.connect(context);
      updater.flushUpdate(host);

      expect(binding.isConnected).toBe(true);
      expect(binding.isUpdating).toBe(false);

      binding.disconnect();

      expect(binding.isConnected).toBe(false);
      expect(binding.isUpdating).toBe(false);
      expect(disconnectSpy).toHaveBeenCalledOnce();
    });

    it('should cancel the update in progress', () => {
      const value = lazy(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new LazyBinding(value, part, context);

      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.connect(context);

      expect(binding.isConnected).toBe(false);
      expect(binding.isUpdating).toBe(true);

      binding.unbind(context);

      expect(binding.isConnected).toBe(false);
      expect(binding.isUpdating).toBe(false);
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith({
        host,
        updater,
        currentBlock: binding,
      });
    });
  });
});
