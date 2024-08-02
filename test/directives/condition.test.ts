import { describe, expect, it, vi } from 'vitest';

import { NodeBinding } from '../../src/binding.js';
import { NoValue } from '../../src/directives.js';
import {
  ConditionBinding,
  condition as conditionDirective,
  unless,
  when,
} from '../../src/directives/condition.js';
import { PartType, directiveTag, nameTag } from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockUpdateHost, TextBinding, TextDirective } from '../mocks.js';

describe('condition()', () => {
  it('should construct a new Condition directive', () => {
    const condition = true;
    const trueBranch = () => 'foo';
    const falseBranch = () => 'bar';
    const value = conditionDirective(condition, trueBranch, falseBranch);

    expect(value.condition).toBe(condition);
    expect(value.trueBranch).toBe(trueBranch);
    expect(value.falseBranch).toBe(falseBranch);
  });
});

describe('when()', () => {
  it('should construct a new Condition without false case', () => {
    const condition = true;
    const trueBranch = () => 'foo';
    const value = when(condition, trueBranch);

    expect(value.condition).toBe(condition);
    expect(value.trueBranch).toBe(trueBranch);
    expect(value.falseBranch()).toBe(NoValue.instance);
  });
});

describe('unless()', () => {
  it('should construct a new Condition without true case', () => {
    const condition = true;
    const falseBranch = () => 'bar';
    const value = unless(condition, falseBranch);

    expect(value.condition).toBe(condition);
    expect(value.trueBranch()).toBe(NoValue.instance);
    expect(value.falseBranch).toBe(falseBranch);
  });
});

describe('Condition', () => {
  describe('[nameTag]', () => {
    it('should return a string represented itself', () => {
      expect(
        conditionDirective(
          true,
          () => 'foo',
          () => 'bar',
        )[nameTag],
      ).toBe('Condition(true, "foo")');
      expect(
        conditionDirective(
          false,
          () => 'foo',
          () => 'bar',
        )[nameTag],
      ).toBe('Condition(false, "bar")');
    });
  });

  describe('[directiveTag]()', () => {
    it('should return a new ConditionBinding from a non-directive value', () => {
      const value = conditionDirective(
        true,
        () => 'foo',
        () => 'bar',
      );
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };
      const binding = value[directiveTag](part, context);
      const getPart = vi.spyOn(binding.currentBinding, 'part', 'get');
      const getStartNode = vi.spyOn(binding.currentBinding, 'startNode', 'get');
      const getEndNode = vi.spyOn(binding.currentBinding, 'endNode', 'get');

      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.currentBinding).toBeInstanceOf(NodeBinding);
      expect(binding.currentBinding.value).toBe('foo');
      expect(getPart).toHaveBeenCalledOnce();
      expect(getStartNode).toHaveBeenCalledOnce();
      expect(getEndNode).toHaveBeenCalledOnce();
    });

    it('should return a new ConditionBinding from a directive value', () => {
      const trueDirective = new TextDirective();
      const falseDirective = new TextDirective();
      const value = conditionDirective(
        false,
        () => trueDirective,
        () => falseDirective,
      );
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };
      const binding = value[directiveTag](part, context);
      const getPart = vi.spyOn(binding.currentBinding, 'part', 'get');
      const getStartNode = vi.spyOn(binding.currentBinding, 'startNode', 'get');
      const getEndNode = vi.spyOn(binding.currentBinding, 'endNode', 'get');

      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.currentBinding).toBeInstanceOf(TextBinding);
      expect(binding.currentBinding.value).toBe(falseDirective);
      expect(getPart).toHaveBeenCalledOnce();
      expect(getStartNode).toHaveBeenCalledOnce();
      expect(getEndNode).toHaveBeenCalledOnce();
    });
  });
});

describe('ConditionBinding', () => {
  describe('.connect()', () => {
    it('should delegate to the current binding', () => {
      const value = conditionDirective(
        true,
        () => 'foo',
        () => 'bar',
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };
      const binding = new ConditionBinding(value, part, context);
      const connectSpy = vi.spyOn(binding.currentBinding, 'connect');

      binding.connect(context);
      updater.flushUpdate(host);

      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.bind()', () => {
    it('should bind the true value to the current binding if the condition is the same', () => {
      const trueDirective = new TextDirective();
      const falseDirective = new TextDirective();
      const trueDirectiveSpy = vi.spyOn(trueDirective, directiveTag);
      const falseDirectiveSpy = vi.spyOn(falseDirective, directiveTag);
      const value = conditionDirective(
        true,
        () => trueDirective,
        () => falseDirective,
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };
      const binding = new ConditionBinding(value, part, context);
      const bindSpy = vi.spyOn(binding.currentBinding, 'bind');

      binding.connect(context);
      updater.flushUpdate(host);

      binding.bind(value, context);
      updater.flushUpdate(host);

      expect(binding.currentBinding.value).toBe(trueDirective);
      expect(trueDirectiveSpy).toHaveBeenCalledOnce();
      expect(falseDirectiveSpy).not.toHaveBeenCalled();
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(falseDirective, context);
    });

    it('should bind the false value to the current binding if the condition is the same', () => {
      const trueDirective = new TextDirective();
      const falseDirective = new TextDirective();
      const trueDirectiveSpy = vi.spyOn(trueDirective, directiveTag);
      const falseDirectiveSpy = vi.spyOn(falseDirective, directiveTag);
      const value = conditionDirective(
        false,
        () => trueDirective,
        () => falseDirective,
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };
      const binding = new ConditionBinding(value, part, context);
      const bindSpy = vi.spyOn(binding.currentBinding, 'bind');

      binding.connect(context);
      updater.flushUpdate(host);

      binding.bind(value, context);
      updater.flushUpdate(host);

      expect(binding.currentBinding.value).toBe(falseDirective);
      expect(trueDirectiveSpy).not.toHaveBeenCalled();
      expect(falseDirectiveSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(trueDirective, context);
    });

    it('should connect a true binding and unbind the false binidng if the condition changes', () => {
      const trueDirective = new TextDirective();
      const falseDirective = new TextDirective();
      const trueDirectiveSpy = vi.spyOn(trueDirective, directiveTag);
      const falseDirectiveSpy = vi.spyOn(falseDirective, directiveTag);
      const value1 = conditionDirective(
        true,
        () => trueDirective,
        () => falseDirective,
      );
      const value2 = conditionDirective(
        false,
        () => trueDirective,
        () => falseDirective,
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };
      const binding = new ConditionBinding(value1, part, context);
      const bindSpy = vi.spyOn(binding.currentBinding, 'bind');
      const unbindSpy = vi.spyOn(binding.currentBinding, 'unbind');

      binding.connect(context);
      updater.flushUpdate(host);

      binding.bind(value2, context);
      updater.flushUpdate(host);

      expect(binding.currentBinding.value).toBe(falseDirective);
      expect(trueDirectiveSpy).toHaveBeenCalledOnce();
      expect(falseDirectiveSpy).toHaveBeenCalledOnce();
      expect(bindSpy).not.toHaveBeenCalled();
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });

    it('should connect a false binding and unbind the true binidng if the condition changes', () => {
      const trueDirective = new TextDirective();
      const falseDirective = new TextDirective();
      const trueDirectiveSpy = vi.spyOn(trueDirective, directiveTag);
      const falseDirectiveSpy = vi.spyOn(falseDirective, directiveTag);
      const value1 = conditionDirective(
        false,
        () => trueDirective,
        () => falseDirective,
      );
      const value2 = conditionDirective(
        true,
        () => trueDirective,
        () => falseDirective,
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };
      const binding = new ConditionBinding(value1, part, context);
      const bindSpy = vi.spyOn(binding.currentBinding, 'bind');
      const unbindSpy = vi.spyOn(binding.currentBinding, 'unbind');

      binding.connect(context);
      updater.flushUpdate(host);

      binding.bind(value2, context);
      updater.flushUpdate(host);

      expect(binding.currentBinding.value).toBe(trueDirective);
      expect(trueDirectiveSpy).toHaveBeenCalledOnce();
      expect(falseDirectiveSpy).toHaveBeenCalledOnce();
      expect(bindSpy).not.toHaveBeenCalled();
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });

    it('should memoize the true binding if key changes', () => {
      const trueDirective = new TextDirective();
      const falseDirective = new TextDirective();
      const trueDirectiveSpy = vi.spyOn(trueDirective, directiveTag);
      const falseDirectiveSpy = vi.spyOn(falseDirective, directiveTag);
      const value1 = conditionDirective(
        true,
        () => trueDirective,
        () => falseDirective,
      );
      const value2 = conditionDirective(
        false,
        () => trueDirective,
        () => falseDirective,
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };
      const binding = new ConditionBinding(value1, part, context);
      const bindSpy = vi.spyOn(binding.currentBinding, 'bind');
      const unbindSpy = vi.spyOn(binding.currentBinding, 'unbind');

      binding.connect(context);
      updater.flushUpdate(host);

      binding.bind(value2, context);
      updater.flushUpdate(host);

      binding.bind(value1, context);
      updater.flushUpdate(host);

      expect(binding.currentBinding.value).toBe(trueDirective);
      expect(trueDirectiveSpy).toHaveBeenCalledOnce();
      expect(falseDirectiveSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });

    it('should memoize the false binding if key changes', () => {
      const trueDirective = new TextDirective();
      const falseDirective = new TextDirective();
      const trueDirectiveSpy = vi.spyOn(trueDirective, directiveTag);
      const falseDirectiveSpy = vi.spyOn(falseDirective, directiveTag);
      const value1 = conditionDirective(
        false,
        () => trueDirective,
        () => falseDirective,
      );
      const value2 = conditionDirective(
        true,
        () => trueDirective,
        () => falseDirective,
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };
      const binding = new ConditionBinding(value1, part, context);
      const bindSpy = vi.spyOn(binding.currentBinding, 'bind');
      const unbindSpy = vi.spyOn(binding.currentBinding, 'unbind');

      binding.connect(context);
      updater.flushUpdate(host);

      binding.bind(value2, context);
      updater.flushUpdate(host);

      binding.bind(value1, context);
      updater.flushUpdate(host);

      expect(binding.currentBinding.value).toBe(falseDirective);
      expect(trueDirectiveSpy).toHaveBeenCalledOnce();
      expect(falseDirectiveSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });

    it('should throw an error if the new value is not Condition directive', () => {
      const value = conditionDirective(
        true,
        () => 'foo',
        () => 'bar',
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };
      const binding = new ConditionBinding(value, part, context);

      expect(() => {
        binding.bind(null as any, context);
      }).toThrow(
        'A value must be a instance of Condition directive, but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should delegate to the current binding', () => {
      const value = conditionDirective(
        true,
        () => 'foo',
        () => 'bar',
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };
      const binding = new ConditionBinding(value, part, context);
      const unbindSpy = vi.spyOn(binding.currentBinding, 'unbind');

      binding.unbind(context);

      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.disconnect()', () => {
    it('should delegate to the current binding', () => {
      const value = conditionDirective(
        true,
        () => 'foo',
        () => 'bar',
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };
      const binding = new ConditionBinding(value, part, context);
      const disconnectSpy = vi.spyOn(binding.currentBinding, 'disconnect');

      binding.disconnect();

      expect(disconnectSpy).toHaveBeenCalledOnce();
    });
  });
});
