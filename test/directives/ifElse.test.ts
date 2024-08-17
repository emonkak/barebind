import { describe, expect, it, vi } from 'vitest';

import {
  PartType,
  UpdateContext,
  directiveTag,
  nameTag,
} from '../../src/baseTypes.js';
import { NodeBinding } from '../../src/binding.js';
import { NoValue } from '../../src/directives.js';
import {
  IfElseBinding,
  ifElse,
  unless,
  when,
} from '../../src/directives/ifElse.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import {
  MockBlock,
  MockUpdateHost,
  TextBinding,
  TextDirective,
} from '../mocks.js';

describe('ifElse()', () => {
  it('should construct a new IfElse directive', () => {
    const trueCase = () => 'foo';
    const falseCase = () => 'bar';

    expect(ifElse(true, trueCase, falseCase).conditional).toStrictEqual({
      condition: true,
      value: 'foo',
    });
    expect(ifElse(false, trueCase, falseCase).conditional).toStrictEqual({
      condition: false,
      value: 'bar',
    });
  });
});

describe('when()', () => {
  it('should construct a new IfElse directive without false case', () => {
    const trueCase = () => 'foo';

    expect(when(true, trueCase).conditional).toStrictEqual({
      condition: true,
      value: 'foo',
    });
    expect(when(false, trueCase).conditional).toStrictEqual({
      condition: false,
      value: NoValue.instance,
    });
  });
});

describe('unless()', () => {
  it('should construct a new IfElse directive without true case', () => {
    const falseCase = () => 'foo';

    expect(unless(true, falseCase).conditional).toStrictEqual({
      condition: true,
      value: NoValue.instance,
    });
    expect(unless(false, falseCase).conditional).toStrictEqual({
      condition: false,
      value: 'foo',
    });
  });
});

describe('IfElse', () => {
  describe('[nameTag]', () => {
    it('should return a string represented itself', () => {
      expect(
        ifElse(
          true,
          () => 'foo',
          () => 'bar',
        )[nameTag],
      ).toBe('IfElse(true, "foo")');
      expect(
        ifElse(
          false,
          () => 'foo',
          () => 'bar',
        )[nameTag],
      ).toBe('IfElse(false, "bar")');
    });
  });

  describe('[directiveTag]()', () => {
    it('should return a new IfElseBinding from a non-directive value', () => {
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = ifElse(
        true,
        () => 'foo',
        () => 'bar',
      );
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

    it('should return a new IfElseBinding from a directive value', () => {
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const trueDirective = new TextDirective();
      const falseDirective = new TextDirective();
      const value = ifElse(
        false,
        () => trueDirective,
        () => falseDirective,
      );
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

describe('IfElseBinding', () => {
  describe('.connect()', () => {
    it('should connecty the current binding', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = ifElse(
        true,
        () => 'foo',
        () => 'bar',
      );
      const binding = new IfElseBinding(value, part, context);

      const connectSpy = vi.spyOn(binding.currentBinding, 'connect');

      binding.connect(context);
      context.flushUpdate();

      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.bind()', () => {
    it('should bind the true value to the current binding if the condition is the same', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const trueDirective = new TextDirective();
      const falseDirective = new TextDirective();
      const trueDirectiveSpy = vi.spyOn(trueDirective, directiveTag);
      const falseDirectiveSpy = vi.spyOn(falseDirective, directiveTag);
      const value = ifElse(
        true,
        () => trueDirective,
        () => falseDirective,
      );
      const binding = new IfElseBinding(value, part, context);

      const bindSpy = vi.spyOn(binding.currentBinding, 'bind');

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value, context);
      context.flushUpdate();

      expect(binding.currentBinding.value).toBe(trueDirective);
      expect(trueDirectiveSpy).toHaveBeenCalledOnce();
      expect(falseDirectiveSpy).not.toHaveBeenCalled();
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(falseDirective, context);
    });

    it('should bind the false value to the current binding if the condition is the same', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const trueDirective = new TextDirective();
      const falseDirective = new TextDirective();
      const trueDirectiveSpy = vi.spyOn(trueDirective, directiveTag);
      const falseDirectiveSpy = vi.spyOn(falseDirective, directiveTag);
      const value = ifElse(
        false,
        () => trueDirective,
        () => falseDirective,
      );
      const binding = new IfElseBinding(value, part, context);

      const bindSpy = vi.spyOn(binding.currentBinding, 'bind');

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value, context);
      context.flushUpdate();

      expect(binding.currentBinding.value).toBe(falseDirective);
      expect(trueDirectiveSpy).not.toHaveBeenCalled();
      expect(falseDirectiveSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(trueDirective, context);
    });

    it('should connect a true binding and unbind the false binidng if the condition changes', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const trueDirective = new TextDirective();
      const falseDirective = new TextDirective();
      const trueDirectiveSpy = vi.spyOn(trueDirective, directiveTag);
      const falseDirectiveSpy = vi.spyOn(falseDirective, directiveTag);
      const value1 = ifElse(
        true,
        () => trueDirective,
        () => falseDirective,
      );
      const value2 = ifElse(
        false,
        () => trueDirective,
        () => falseDirective,
      );
      const binding = new IfElseBinding(value1, part, context);

      const bindSpy = vi.spyOn(binding.currentBinding, 'bind');
      const unbindSpy = vi.spyOn(binding.currentBinding, 'unbind');

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);
      context.flushUpdate();

      expect(binding.currentBinding.value).toBe(falseDirective);
      expect(trueDirectiveSpy).toHaveBeenCalledOnce();
      expect(falseDirectiveSpy).toHaveBeenCalledOnce();
      expect(bindSpy).not.toHaveBeenCalled();
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });

    it('should connect a false binding and unbind the true binidng if the condition changes', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const trueDirective = new TextDirective();
      const falseDirective = new TextDirective();
      const trueDirectiveSpy = vi.spyOn(trueDirective, directiveTag);
      const falseDirectiveSpy = vi.spyOn(falseDirective, directiveTag);
      const value1 = ifElse(
        false,
        () => trueDirective,
        () => falseDirective,
      );
      const value2 = ifElse(
        true,
        () => trueDirective,
        () => falseDirective,
      );
      const binding = new IfElseBinding(value1, part, context);

      const bindSpy = vi.spyOn(binding.currentBinding, 'bind');
      const unbindSpy = vi.spyOn(binding.currentBinding, 'unbind');

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);
      context.flushUpdate();

      expect(binding.currentBinding.value).toBe(trueDirective);
      expect(trueDirectiveSpy).toHaveBeenCalledOnce();
      expect(falseDirectiveSpy).toHaveBeenCalledOnce();
      expect(bindSpy).not.toHaveBeenCalled();
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });

    it('should memoize the true binding if key changes', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const trueDirective = new TextDirective();
      const falseDirective = new TextDirective();
      const trueDirectiveSpy = vi.spyOn(trueDirective, directiveTag);
      const falseDirectiveSpy = vi.spyOn(falseDirective, directiveTag);
      const value1 = ifElse(
        true,
        () => trueDirective,
        () => falseDirective,
      );
      const value2 = ifElse(
        false,
        () => trueDirective,
        () => falseDirective,
      );
      const binding = new IfElseBinding(value1, part, context);

      const bindSpy = vi.spyOn(binding.currentBinding, 'bind');
      const unbindSpy = vi.spyOn(binding.currentBinding, 'unbind');

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);
      context.flushUpdate();

      binding.bind(value1, context);
      context.flushUpdate();

      expect(binding.currentBinding.value).toBe(trueDirective);
      expect(trueDirectiveSpy).toHaveBeenCalledOnce();
      expect(falseDirectiveSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });

    it('should memoize the false binding if key changes', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const trueDirective = new TextDirective();
      const falseDirective = new TextDirective();
      const trueDirectiveSpy = vi.spyOn(trueDirective, directiveTag);
      const falseDirectiveSpy = vi.spyOn(falseDirective, directiveTag);
      const value1 = ifElse(
        false,
        () => trueDirective,
        () => falseDirective,
      );
      const value2 = ifElse(
        true,
        () => trueDirective,
        () => falseDirective,
      );
      const binding = new IfElseBinding(value1, part, context);

      const bindSpy = vi.spyOn(binding.currentBinding, 'bind');
      const unbindSpy = vi.spyOn(binding.currentBinding, 'unbind');

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);
      context.flushUpdate();

      binding.bind(value1, context);
      context.flushUpdate();

      expect(binding.currentBinding.value).toBe(falseDirective);
      expect(trueDirectiveSpy).toHaveBeenCalledOnce();
      expect(falseDirectiveSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });

    it('should throw an error if the new value is not Condition directive', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = ifElse(
        true,
        () => 'foo',
        () => 'bar',
      );
      const binding = new IfElseBinding(value, part, context);

      expect(() => {
        binding.bind(null as any, context);
      }).toThrow(
        'A value must be a instance of IfElse directive, but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should unbind the current binding', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = ifElse(
        true,
        () => 'foo',
        () => 'bar',
      );
      const binding = new IfElseBinding(value, part, context);

      const unbindSpy = vi.spyOn(binding.currentBinding, 'unbind');

      binding.unbind(context);

      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect the current binding', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = ifElse(
        true,
        () => 'foo',
        () => 'bar',
      );
      const binding = new IfElseBinding(value, part, context);

      const disconnectSpy = vi.spyOn(binding.currentBinding, 'disconnect');

      binding.disconnect();

      expect(disconnectSpy).toHaveBeenCalledOnce();
    });
  });
});
