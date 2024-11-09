import { describe, expect, it, vi } from 'vitest';

import { PartType, UpdateContext, directiveTag } from '../../src/baseTypes.js';
import { NoValue } from '../../src/directives.js';
import {
  Either,
  EitherBinding,
  optional,
} from '../../src/directives/either.js';
import { SyncUpdater } from '../../src/updaters/syncUpdater.js';
import {
  MockBlock,
  MockRenderHost,
  TextBinding,
  TextDirective,
} from '../mocks.js';

describe('Either.left()', () => {
  it('should construct a Left directive', () => {
    expect(Either.left('foo')).toStrictEqual(new Either.Left('foo'));
  });
});

describe('Either.right()', () => {
  it('should construct a Right directive', () => {
    expect(Either.right('foo')).toStrictEqual(new Either.Right('foo'));
  });
});

describe('optional()', () => {
  it('should construct a Right directive if the value is not null or undefined', () => {
    expect(optional('foo')).toStrictEqual(new Either.Right('foo'));
    expect(optional(null)).toStrictEqual(new Either.Left(NoValue.instance));
  });
});

describe('Left', () => {
  describe('[Symbol.toStringTag]', () => {
    it('should return a string represented itself', () => {
      expect(new Either.Left('foo')[Symbol.toStringTag]).toBe(
        'Either.Left("foo")',
      );
    });
  });

  describe('[directiveTag]()', () => {
    it('should create a new EitherBinding', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = new Either.Left(new TextDirective('foo'));
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const binding = value[directiveTag](part, context);

      const getPart = vi.spyOn(binding.binding, 'part', 'get');
      const getStartNode = vi.spyOn(binding.binding, 'startNode', 'get');
      const getEndNode = vi.spyOn(binding.binding, 'endNode', 'get');

      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.binding).toBeInstanceOf(TextBinding);
      expect(binding.binding.value).toBe(value.value);
      expect(getPart).toHaveBeenCalledOnce();
      expect(getStartNode).toHaveBeenCalledOnce();
      expect(getEndNode).toHaveBeenCalledOnce();
    });
  });
});

describe('Right', () => {
  describe('[Symbol.toStringTag]', () => {
    it('should return a string represented itself', () => {
      expect(new Either.Right('foo')[Symbol.toStringTag]).toBe(
        'Either.Right("foo")',
      );
    });
  });

  describe('[directiveTag]()', () => {
    it('should create a new EitherBinding', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = new Either.Right(new TextDirective('foo'));
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const binding = value[directiveTag](part, context);

      const getPart = vi.spyOn(binding.binding, 'part', 'get');
      const getStartNode = vi.spyOn(binding.binding, 'startNode', 'get');
      const getEndNode = vi.spyOn(binding.binding, 'endNode', 'get');

      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.binding).toBeInstanceOf(TextBinding);
      expect(binding.binding.value).toBe(value.value);
      expect(getPart).toHaveBeenCalledOnce();
      expect(getStartNode).toHaveBeenCalledOnce();
      expect(getEndNode).toHaveBeenCalledOnce();
    });
  });
});

describe('EitherBinding', () => {
  describe('.connect()', () => {
    it.each([
      [
        new Either.Left(new TextDirective('foo')),
        new Either.Right(new TextDirective('bar')),
      ],
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

      const connectSpy = vi.spyOn(binding.binding, 'connect');

      binding.connect(context);
      context.flushUpdate();

      expect(binding.binding.value).toBe(value.value);
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.bind()', () => {
    it.each([
      [
        new Either.Left(new TextDirective('foo')),
        new Either.Left(new TextDirective('bar')),
      ],
      [
        new Either.Right(new TextDirective('foo')),
        new Either.Right(new TextDirective('bar')),
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

        expect(binding.binding).toBe(binding1);
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
      [
        new Either.Left(new TextDirective('foo')),
        new Either.Right(new TextDirective('bar')),
      ],
      [
        new Either.Right(new TextDirective('foo')),
        new Either.Left(new TextDirective('bar')),
      ],
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

        expect(binding.binding).toBe(binding1);
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

    it.each([[new Either.Left('foo')], [new Either.Right('bar')]])(
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

        // BUG: In vitest, "Either" becomes "Either2".
        expect(() => {
          binding.bind(null as any, context);
        }).toThrow(
          'The value must be a instance of Either2 directive, but got "null".',
        );
      },
    );
  });

  describe('.unbind()', () => {
    it.each([
      [new Either.Left(new TextDirective('foo'))],
      [new Either.Right(new TextDirective('bar'))],
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

      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.unbind(context);

      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.disconnect()', () => {
    it.each([
      [new Either.Left(new TextDirective('foo'))],
      [new Either.Right(new TextDirective('bar'))],
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

      const disconnectSpy = vi.spyOn(binding.binding, 'disconnect');

      binding.disconnect(context);

      expect(disconnectSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).toHaveBeenCalledWith(context);
    });
  });
});
