import { describe, expect, it, vi } from 'vitest';

import {
  PartType,
  UpdateContext,
  directiveTag,
  nameTag,
} from '../../src/baseTypes.js';
import { NoValue } from '../../src/directives.js';
import {
  EitherBinding,
  Left,
  Right,
  ifElse,
  unless,
  when,
} from '../../src/directives/either.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import {
  MockBlock,
  MockRenderHost,
  TextBinding,
  TextDirective,
} from '../mocks.js';

describe('ifElse()', () => {
  it('should construct a Left or Right directive depending on the condition', () => {
    const thenBlock = () => 'foo';
    const elseBlock = () => 'bar';

    expect(ifElse(true, thenBlock, elseBlock)).toEqual(new Left('foo'));
    expect(ifElse(false, thenBlock, elseBlock)).toEqual(new Right('bar'));
  });
});

describe('when()', () => {
  it('should construct a Left or Right directive depending on the condition', () => {
    const thenBlock = () => 'foo';

    expect(when(true, thenBlock)).toStrictEqual(new Left('foo'));
    expect(when(false, thenBlock)).toStrictEqual(new Right(NoValue.instance));
  });
});

describe('unless()', () => {
  it('should construct a Left or Right directive depending on the condition', () => {
    const elseBlock = () => 'foo';

    expect(unless(true, elseBlock)).toStrictEqual(new Left(NoValue.instance));
    expect(unless(false, elseBlock)).toStrictEqual(new Right('foo'));
  });
});

describe('Left', () => {
  describe('[nameTag]', () => {
    it('should return a string represented itself', () => {
      expect(new Left('foo')[nameTag]).toBe('Left("foo")');
    });
  });

  describe('[directiveTag]()', () => {
    it('should create a new EitherBinding', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = new Left(new TextDirective('foo'));
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const binding = value[directiveTag](part, context);

      const getPart = vi.spyOn(binding.currentBinding, 'part', 'get');
      const getStartNode = vi.spyOn(binding.currentBinding, 'startNode', 'get');
      const getEndNode = vi.spyOn(binding.currentBinding, 'endNode', 'get');

      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.currentBinding).toBeInstanceOf(TextBinding);
      expect(binding.currentBinding.value).toBe(value.value);
      expect(getPart).toHaveBeenCalledOnce();
      expect(getStartNode).toHaveBeenCalledOnce();
      expect(getEndNode).toHaveBeenCalledOnce();
    });
  });
});

describe('Right', () => {
  describe('[nameTag]', () => {
    it('should return a string represented itself', () => {
      expect(new Right('foo')[nameTag]).toBe('Right("foo")');
    });
  });

  describe('[directiveTag]()', () => {
    it('should create a new EitherBinding', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = new Right(new TextDirective('foo'));
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const binding = value[directiveTag](part, context);

      const getPart = vi.spyOn(binding.currentBinding, 'part', 'get');
      const getStartNode = vi.spyOn(binding.currentBinding, 'startNode', 'get');
      const getEndNode = vi.spyOn(binding.currentBinding, 'endNode', 'get');

      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.currentBinding).toBeInstanceOf(TextBinding);
      expect(binding.currentBinding.value).toBe(value.value);
      expect(getPart).toHaveBeenCalledOnce();
      expect(getStartNode).toHaveBeenCalledOnce();
      expect(getEndNode).toHaveBeenCalledOnce();
    });
  });
});

describe('EitherBinding', () => {
  describe('.connect()', () => {
    it.each([
      [new Left(new TextDirective('foo')), new Right(new TextDirective('bar'))],
    ])('should connect the current binding', (value) => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new EitherBinding(value, part, context);

      const connectSpy = vi.spyOn(binding.currentBinding, 'connect');

      binding.connect(context);
      context.flushUpdate();

      expect(binding.currentBinding.value).toBe(value.value);
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.bind()', () => {
    it.each([
      [new Left(new TextDirective('foo')), new Left(new TextDirective('bar'))],
      [
        new Right(new TextDirective('foo')),
        new Right(new TextDirective('bar')),
      ],
    ])(
      'should bind a left or right value to the current binding if the previous value is also the same type',
      (value1, value2) => {
        const context = new UpdateContext(
          new MockRenderHost(),
          new SyncUpdater(),
          new MockBlock(),
        );

        const part = {
          type: PartType.ChildNode,
          node: document.createComment(''),
        } as const;
        const binding1 = new TextBinding(value1.value, part);
        const binding2 = new TextBinding(value2.value, part);

        const directive1Spy = vi
          .spyOn(value1.value, directiveTag)
          .mockReturnValue(binding1);
        const directive2Spy = vi
          .spyOn(value2.value, directiveTag)
          .mockReturnValue(binding2);
        const connect1Spy = vi.spyOn(binding1, 'connect');
        const connect2Spy = vi.spyOn(binding2, 'connect');
        const bind1Spy = vi.spyOn(binding1, 'bind');
        const bind2Spy = vi.spyOn(binding2, 'bind');

        const binding = new EitherBinding(value1, part, context);

        binding.connect(context);
        context.flushUpdate();

        binding.bind(value2, context);
        context.flushUpdate();

        expect(binding.currentBinding).toBe(binding1);
        expect(directive1Spy).toHaveBeenCalledOnce();
        expect(directive1Spy).toHaveBeenCalledWith(part, context);
        expect(directive2Spy).not.toHaveBeenCalled();
        expect(connect1Spy).toHaveBeenCalledOnce();
        expect(connect1Spy).toHaveBeenCalledWith(context);
        expect(connect2Spy).not.toHaveBeenCalled();
        expect(bind1Spy).toHaveBeenCalledOnce();
        expect(bind1Spy).toHaveBeenCalledWith(value2.value, context);
        expect(bind2Spy).not.toHaveBeenCalledOnce();
      },
    );

    it.each([
      [new Left(new TextDirective('foo')), new Right(new TextDirective('bar'))],
      [new Right(new TextDirective('foo')), new Left(new TextDirective('bar'))],
    ])(
      'should memoize the previous binding if the value type changes',
      (value1, value2) => {
        const context = new UpdateContext(
          new MockRenderHost(),
          new SyncUpdater(),
          new MockBlock(),
        );

        const part = {
          type: PartType.ChildNode,
          node: document.createComment(''),
        } as const;
        const binding1 = new TextBinding(value1.value, part);
        const binding2 = new TextBinding(value2.value, part);

        const directive1Spy = vi
          .spyOn(value1.value, directiveTag)
          .mockReturnValue(binding1);
        const directive2Spy = vi
          .spyOn(value2.value, directiveTag)
          .mockReturnValue(binding2);
        const connect1Spy = vi.spyOn(binding1, 'connect');
        const connect2Spy = vi.spyOn(binding2, 'connect');
        const bind1Spy = vi.spyOn(binding1, 'bind');
        const bind2Spy = vi.spyOn(binding2, 'bind');
        const unbind1Spy = vi.spyOn(binding1, 'unbind');
        const unbind2Spy = vi.spyOn(binding2, 'unbind');

        const binding = new EitherBinding(value1, part, context);

        binding.connect(context);
        context.flushUpdate();

        binding.bind(value2, context);
        context.flushUpdate();

        binding.bind(value1, context);
        context.flushUpdate();

        expect(binding.currentBinding).toBe(binding1);
        expect(directive1Spy).toHaveBeenCalledOnce();
        expect(directive1Spy).toHaveBeenCalledWith(part, context);
        expect(directive2Spy).toHaveBeenCalledOnce();
        expect(directive2Spy).toHaveBeenCalledWith(part, context);
        expect(connect1Spy).toHaveBeenCalledOnce();
        expect(connect1Spy).toHaveBeenCalledWith(context);
        expect(connect2Spy).toHaveBeenCalledOnce();
        expect(connect2Spy).toHaveBeenCalledWith(context);
        expect(bind1Spy).toHaveBeenCalledOnce();
        expect(bind1Spy).toHaveBeenCalledWith(value1.value, context);
        expect(bind2Spy).not.toHaveBeenCalled();
        expect(unbind1Spy).toHaveBeenCalledOnce();
        expect(unbind1Spy).toHaveBeenCalledWith(context);
        expect(unbind2Spy).toHaveBeenCalledOnce();
        expect(unbind2Spy).toHaveBeenCalledWith(context);
      },
    );

    it.each([[new Left('foo')], [new Right('bar')]])(
      'should throw an error if the new value is not Left or Right directive',
      (value) => {
        const context = new UpdateContext(
          new MockRenderHost(),
          new SyncUpdater(),
          new MockBlock(),
        );

        const part = {
          type: PartType.ChildNode,
          node: document.createComment(''),
        } as const;
        const binding = new EitherBinding(value, part, context);

        expect(() => {
          binding.bind(null as any, context);
        }).toThrow(
          'A value must be a instance of Left or Right directive, but got "null".',
        );
      },
    );
  });

  describe('.unbind()', () => {
    it.each([
      [new Left(new TextDirective('foo'))],
      [new Right(new TextDirective('bar'))],
    ])('should unbind the current binding', (value) => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new EitherBinding(value, part, context);

      const unbindSpy = vi.spyOn(binding.currentBinding, 'unbind');

      binding.unbind(context);

      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.disconnect()', () => {
    it.each([
      [new Left(new TextDirective('foo'))],
      [new Right(new TextDirective('bar'))],
    ])('should disconnect the current binding', (value) => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new EitherBinding(value, part, context);

      const disconnectSpy = vi.spyOn(binding.currentBinding, 'disconnect');

      binding.disconnect(context);

      expect(disconnectSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).toHaveBeenCalledWith(context);
    });
  });
});
