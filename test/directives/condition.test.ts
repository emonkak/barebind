import { describe, expect, it, vi } from 'vitest';

import { NodeBinding } from '../../src/binding.js';
import { NoValueDirective } from '../../src/directives.js';
import {
  ConditionBinding,
  condition as conditionDirective,
  unless,
  when,
} from '../../src/directives/condition.js';
import { PartType, directiveTag, hintTag } from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockBinding, MockDirective, MockUpdateContext } from '../mocks.js';

describe('condition()', () => {
  it('should construct a new ConditionDirective', () => {
    const condition = true;
    const trueBranch = () => 'foo';
    const falseBranch = () => 'bar';
    const directive = conditionDirective(condition, trueBranch, falseBranch);

    expect(directive.condition).toBe(condition);
    expect(directive.trueBranch).toBe(trueBranch);
    expect(directive.falseBranch).toBe(falseBranch);
  });
});

describe('when()', () => {
  it('should construct a new ConditionDirective without false case', () => {
    const condition = true;
    const trueBranch = () => 'foo';
    const directive = when(condition, trueBranch);

    expect(directive.condition).toBe(condition);
    expect(directive.trueBranch).toBe(trueBranch);
    expect(directive.falseBranch).toBe(NoValueDirective.instance);
  });
});

describe('unless()', () => {
  it('should construct a new ConditionDirective without true case', () => {
    const condition = true;
    const falseBranch = () => 'bar';
    const directive = unless(condition, falseBranch);

    expect(directive.condition).toBe(condition);
    expect(directive.trueBranch).toBe(NoValueDirective.instance);
    expect(directive.falseBranch).toBe(falseBranch);
  });
});

describe('ConditionDirective', () => {
  describe('[hintTag]', () => {
    it('should return a hint string', () => {
      expect(
        conditionDirective(
          true,
          () => 'foo',
          () => 'bar',
        )[hintTag],
      ).toBe('ConditionDirective(foo)');
      expect(
        conditionDirective(
          false,
          () => 'foo',
          () => 'bar',
        )[hintTag],
      ).toBe('ConditionDirective(bar)');
    });
  });

  describe('[directiveTag]()', () => {
    it('should return an instance of ConditionBinding from a non-directive value', () => {
      const directive = conditionDirective(
        true,
        () => 'foo',
        () => 'bar',
      );
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const updater = new SyncUpdater(new MockUpdateContext());
      const binding = directive[directiveTag](part, updater);
      const getPart = vi.spyOn(binding.currentBinding, 'part', 'get');
      const getStartNode = vi.spyOn(binding.currentBinding, 'startNode', 'get');
      const getEndNode = vi.spyOn(binding.currentBinding, 'endNode', 'get');

      expect(binding.value).toBe(directive);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.currentBinding).toBeInstanceOf(NodeBinding);
      expect(binding.currentBinding.value).toBe('foo');
      expect(getPart).toHaveBeenCalledOnce();
      expect(getStartNode).toHaveBeenCalledOnce();
      expect(getEndNode).toHaveBeenCalledOnce();
    });

    it('should return an instance of ConditionBinding from a directive', () => {
      const trueDirective = new MockDirective();
      const falseDirective = new MockDirective();
      const directive = conditionDirective(
        false,
        trueDirective,
        falseDirective,
      );
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const updater = new SyncUpdater(new MockUpdateContext());
      const binding = directive[directiveTag](part, updater);
      const getPart = vi.spyOn(binding.currentBinding, 'part', 'get');
      const getStartNode = vi.spyOn(binding.currentBinding, 'startNode', 'get');
      const getEndNode = vi.spyOn(binding.currentBinding, 'endNode', 'get');

      expect(binding.value).toBe(directive);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.currentBinding).toBeInstanceOf(MockBinding);
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
      const directive = conditionDirective(
        true,
        () => 'foo',
        () => 'bar',
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockUpdateContext());
      const binding = new ConditionBinding(directive, part, updater);
      const connectSpy = vi.spyOn(binding.currentBinding, 'connect');

      binding.connect(updater);
      updater.flush();

      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(updater);
    });
  });

  describe('.bind()', () => {
    it('should bind the true value to the current binding if the condition is the same', () => {
      const trueDirective = new MockDirective();
      const falseDirective = new MockDirective();
      const trueDirectiveSpy = vi.spyOn(trueDirective, directiveTag);
      const falseDirectiveSpy = vi.spyOn(falseDirective, directiveTag);
      const directive = conditionDirective(true, trueDirective, falseDirective);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockUpdateContext());
      const binding = new ConditionBinding(directive, part, updater);
      const bindSpy = vi.spyOn(binding.currentBinding, 'bind');

      binding.connect(updater);
      updater.flush();

      binding.bind(directive, updater);
      updater.flush();

      expect(binding.currentBinding.value).toBe(trueDirective);
      expect(trueDirectiveSpy).toHaveBeenCalledOnce();
      expect(falseDirectiveSpy).not.toHaveBeenCalled();
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(falseDirective, updater);
    });

    it('should bind the false value to the current binding if the condition is the same', () => {
      const trueDirective = new MockDirective();
      const falseDirective = new MockDirective();
      const trueDirectiveSpy = vi.spyOn(trueDirective, directiveTag);
      const falseDirectiveSpy = vi.spyOn(falseDirective, directiveTag);
      const directive = conditionDirective(
        false,
        trueDirective,
        falseDirective,
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockUpdateContext());
      const binding = new ConditionBinding(directive, part, updater);
      const bindSpy = vi.spyOn(binding.currentBinding, 'bind');

      binding.connect(updater);
      updater.flush();

      binding.bind(directive, updater);
      updater.flush();

      expect(binding.currentBinding.value).toBe(falseDirective);
      expect(trueDirectiveSpy).not.toHaveBeenCalled();
      expect(falseDirectiveSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(trueDirective, updater);
    });

    it('should connect a true binding and unbind the false binidng if the condition changes', () => {
      const trueDirective = new MockDirective();
      const falseDirective = new MockDirective();
      const trueDirectiveSpy = vi.spyOn(trueDirective, directiveTag);
      const falseDirectiveSpy = vi.spyOn(falseDirective, directiveTag);
      const directive1 = conditionDirective(
        true,
        trueDirective,
        falseDirective,
      );
      const directive2 = conditionDirective(
        false,
        trueDirective,
        falseDirective,
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockUpdateContext());
      const binding = new ConditionBinding(directive1, part, updater);
      const bindSpy = vi.spyOn(binding.currentBinding, 'bind');
      const unbindSpy = vi.spyOn(binding.currentBinding, 'unbind');

      binding.connect(updater);
      updater.flush();

      binding.bind(directive2, updater);
      updater.flush();

      expect(binding.currentBinding.value).toBe(falseDirective);
      expect(trueDirectiveSpy).toHaveBeenCalledOnce();
      expect(falseDirectiveSpy).toHaveBeenCalledOnce();
      expect(bindSpy).not.toHaveBeenCalled();
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(updater);
    });

    it('should connect a false binding and unbind the true binidng if the condition changes', () => {
      const trueDirective = new MockDirective();
      const falseDirective = new MockDirective();
      const trueDirectiveSpy = vi.spyOn(trueDirective, directiveTag);
      const falseDirectiveSpy = vi.spyOn(falseDirective, directiveTag);
      const directive1 = conditionDirective(
        false,
        trueDirective,
        falseDirective,
      );
      const directive2 = conditionDirective(
        true,
        trueDirective,
        falseDirective,
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockUpdateContext());
      const binding = new ConditionBinding(directive1, part, updater);
      const bindSpy = vi.spyOn(binding.currentBinding, 'bind');
      const unbindSpy = vi.spyOn(binding.currentBinding, 'unbind');

      binding.connect(updater);
      updater.flush();

      binding.bind(directive2, updater);
      updater.flush();

      expect(binding.currentBinding.value).toBe(trueDirective);
      expect(trueDirectiveSpy).toHaveBeenCalledOnce();
      expect(falseDirectiveSpy).toHaveBeenCalledOnce();
      expect(bindSpy).not.toHaveBeenCalled();
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(updater);
    });

    it('should memoize the true binding if key changes', () => {
      const trueDirective = new MockDirective();
      const falseDirective = new MockDirective();
      const trueDirectiveSpy = vi.spyOn(trueDirective, directiveTag);
      const falseDirectiveSpy = vi.spyOn(falseDirective, directiveTag);
      const directive1 = conditionDirective(
        true,
        trueDirective,
        falseDirective,
      );
      const directive2 = conditionDirective(
        false,
        trueDirective,
        falseDirective,
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockUpdateContext());
      const binding = new ConditionBinding(directive1, part, updater);
      const bindSpy = vi.spyOn(binding.currentBinding, 'bind');
      const unbindSpy = vi.spyOn(binding.currentBinding, 'unbind');

      binding.connect(updater);
      updater.flush();

      binding.bind(directive2, updater);
      updater.flush();

      binding.bind(directive1, updater);
      updater.flush();

      expect(binding.currentBinding.value).toBe(trueDirective);
      expect(trueDirectiveSpy).toHaveBeenCalledOnce();
      expect(falseDirectiveSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(updater);
    });

    it('should memoize the false binding if key changes', () => {
      const trueDirective = new MockDirective();
      const falseDirective = new MockDirective();
      const trueDirectiveSpy = vi.spyOn(trueDirective, directiveTag);
      const falseDirectiveSpy = vi.spyOn(falseDirective, directiveTag);
      const directive1 = conditionDirective(
        false,
        trueDirective,
        falseDirective,
      );
      const directive2 = conditionDirective(
        true,
        trueDirective,
        falseDirective,
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockUpdateContext());
      const binding = new ConditionBinding(directive1, part, updater);
      const bindSpy = vi.spyOn(binding.currentBinding, 'bind');
      const unbindSpy = vi.spyOn(binding.currentBinding, 'unbind');

      binding.connect(updater);
      updater.flush();

      binding.bind(directive2, updater);
      updater.flush();

      binding.bind(directive1, updater);
      updater.flush();

      expect(binding.currentBinding.value).toBe(falseDirective);
      expect(trueDirectiveSpy).toHaveBeenCalledOnce();
      expect(falseDirectiveSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(updater);
    });

    it('should throw an error if the new value is not MemoDirective', () => {
      const directive = conditionDirective(
        true,
        () => 'foo',
        () => 'bar',
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockUpdateContext());
      const binding = new ConditionBinding(directive, part, updater);

      expect(() => {
        binding.bind(null as any, updater);
      }).toThrow(
        'A value must be a instance of "ConditionDirective", but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should delegate to the current binding', () => {
      const directive = conditionDirective(
        true,
        () => 'foo',
        () => 'bar',
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockUpdateContext());
      const binding = new ConditionBinding(directive, part, updater);
      const unbindSpy = vi.spyOn(binding.currentBinding, 'unbind');

      binding.unbind(updater);

      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(updater);
    });
  });

  describe('.disconnect()', () => {
    it('should delegate to the current binding', () => {
      const directive = conditionDirective(
        true,
        () => 'foo',
        () => 'bar',
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockUpdateContext());
      const binding = new ConditionBinding(directive, part, updater);
      const disconnectSpy = vi.spyOn(binding.currentBinding, 'disconnect');

      binding.disconnect();

      expect(disconnectSpy).toHaveBeenCalledOnce();
    });
  });
});
