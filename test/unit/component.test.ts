import { describe, expect, it, vi } from 'vitest';

import { ComponentBinding, createComponent } from '@/component.js';
import type { CommitPhase, RenderContext } from '@/core.js';
import { Directive } from '@/core.js';
import { ConcurrentLane } from '@/lane.js';
import { createChildNodePart, HTML_NAMESPACE_URI } from '@/part.js';
import { RenderSession } from '@/render-session.js';
import { SLOT_STATUS_DETACHED, SLOT_STATUS_IDLE } from '@/slot.js';
import { createRuntime } from '../mocks.js';
import { TestRenderer } from '../test-renderer.js';
import { TestUpdater } from '../test-updater.js';

describe('createComponent()', () => {
  it('returns a directive with props', () => {
    const props = { greet: 'Hello', name: 'foo' };
    const directive = Greet(props) as Directive<GreetProps>;

    expect(directive).toBeInstanceOf(Directive);
    expect(directive.type).toBe(Greet);
    expect(directive.value).toBe(props);
  });

  describe('name', () => {
    it('returns the component function name', () => {
      function MyComponent() {
        return null;
      }

      expect(createComponent(MyComponent).name).toBe(MyComponent.name);
    });
  });

  describe('render()', () => {
    it('invokes the render function with props', () => {
      const render = vi.fn(() => null);
      const component = createComponent(render);
      const renderer = new TestRenderer((props, session) => {
        return component.render(props, session);
      });
      const props = {};

      renderer.render(props);

      expect(render).toHaveBeenCalledOnce();
      expect(render).toHaveBeenCalledWith(props, expect.any(RenderSession));
    });
  });

  describe('arePropsEqual()', () => {
    it('returns whether the props is the same with Object.is equality', () => {
      const props1 = { greet: 'Hello', name: 'foo' };
      const props2 = { greet: 'Chao', name: 'bar' };

      expect(Greet.arePropsEqual(props1, props1)).toBe(true);
      expect(Greet.arePropsEqual(props1, props2)).toBe(false);
      expect(Greet.arePropsEqual(props2, props1)).toBe(false);
      expect(Greet.arePropsEqual(props2, props2)).toBe(true);
    });

    it.each([
      [{ key: 'foo', value: 1 }, { key: 'foo', value: 1 }, true],
      [{ key: 'foo', value: 1 }, { key: 'bar', value: 2 }, false],
    ])('returns whether the props is the same with a custom equality', (props1, props2, expandedResult) => {
      expect(Memo.arePropsEqual(props1, props1)).toBe(true);
      expect(Memo.arePropsEqual(props1, props2)).toBe(expandedResult);
      expect(Memo.arePropsEqual(props2, props1)).toBe(expandedResult);
      expect(Memo.arePropsEqual(props2, props2)).toBe(true);
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new ComponentBinding', () => {
      const props = { greet: 'Hello', name: 'foo' };
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const runtime = createRuntime();
      const binding = Greet.resolveBinding(
        props,
        part,
        runtime,
      ) as ComponentBinding<typeof props, unknown>;

      expect(binding).toBeInstanceOf(ComponentBinding);
      expect(binding.name).toBe(Greet.name);
      expect(binding.type).toBe(Greet);
      expect(binding.value).toBe(props);
      expect(binding.part).toBe(part);
    });
  });
});

describe('ComponentBinding', () => {
  describe('shouldUpdate()', () => {
    it('returns true if the committed value does not exist', () => {
      const props = { greet: 'Hello', name: 'foo' };
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const binding = new ComponentBinding(Greet, props, part);

      expect(binding.shouldUpdate(props)).toBe(true);
    });

    it('returns true if the committed value is different from the new one', () => {
      const props1 = { greet: 'Hello', name: 'foo' };
      const props2 = { greet: 'Chao', name: 'bar' };
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const binding = new ComponentBinding(Greet, props1, part);
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          session.frame.coroutines.push(binding);
        });

        expect(binding.shouldUpdate(props1)).toBe(false);
        expect(binding.shouldUpdate(props2)).toBe(true);
      }
    });
  });

  describe('attach()', () => {
    it('renders the component', () => {
      const props1 = {
        name: 'foo',
        greet: 'Hello',
      };
      const props2 = {
        name: 'bar',
        greet: 'Chao',
      };
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const binding = new ComponentBinding(Greet, props1, part);
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          session.frame.mutationEffects.push(binding, session.scope.level);
        });

        expect(binding['_slot']).toStrictEqual(
          expect.objectContaining({
            status: SLOT_STATUS_IDLE,
          }),
        );
        expect(binding['_slot']?.part).toBe(part);
        expect(part.node.nodeValue).toBe('Hello, foo!');
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.value = props2;
          binding.attach(session);
          session.frame.mutationEffects.push(binding, session.scope.level);
        });

        expect(binding['_slot']).toStrictEqual(
          expect.objectContaining({
            status: SLOT_STATUS_IDLE,
          }),
        );
        expect(binding['_slot']?.part).toBe(part);
        expect(part.node.nodeValue).toBe('Chao, bar!');
      }
    });
  });

  describe('detach()', () => {
    it('cleans effect hooks', () => {
      const props = {
        callback: vi.fn(),
        cleanup: vi.fn(),
      };
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const binding = new ComponentBinding(EnqueueEffect, props, part);
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          session.frame.mutationEffects.push(binding, session.scope.level);
        });

        expect(binding['_slot']).toStrictEqual(
          expect.objectContaining({
            status: SLOT_STATUS_IDLE,
          }),
        );
        expect(binding['_slot']?.part).toBe(part);
        expect(part.node.nodeValue).toBe('3 effects are enqueued');
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.detach(session);
          binding.rollback();
        });

        expect(binding['_slot']).toStrictEqual(
          expect.objectContaining({
            status: SLOT_STATUS_IDLE,
          }),
        );
        expect(binding['_slot']?.part).toBe(part);
        expect(props.callback).toHaveBeenCalledTimes(3);
        expect(props.callback).toHaveBeenNthCalledWith(1, 'mutation');
        expect(props.callback).toHaveBeenNthCalledWith(2, 'layout');
        expect(props.callback).toHaveBeenNthCalledWith(3, 'passive');
        expect(props.cleanup).toHaveBeenCalledTimes(3);
        expect(props.cleanup).toHaveBeenNthCalledWith(1, 'mutation');
        expect(props.cleanup).toHaveBeenNthCalledWith(2, 'layout');
        expect(props.cleanup).toHaveBeenNthCalledWith(3, 'passive');
        expect(part.node.nodeValue).toBe('');
      }
    });

    it('does not invoke pending effects when the component is detached', () => {
      const props = {
        callback: vi.fn(),
        cleanup: vi.fn(),
      };
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const binding = new ComponentBinding(EnqueueEffect, props, part);
      const updater = new TestUpdater();

      SESSION: {
        updater.startUpdate((session) => {
          binding.attach(session);

          session.frame.coroutines.push({
            name: '',
            pendingLanes: ConcurrentLane,
            scope: session.scope,
            start() {
              session.frame.coroutines.push(this);
            },
            resume(session) {
              binding.detach(session);
            },
          });
        });

        expect(binding['_slot']).toStrictEqual(
          expect.objectContaining({
            status: SLOT_STATUS_DETACHED,
          }),
        );
        expect(binding['_slot']?.part).toBe(part);
        expect(props.callback).not.toHaveBeenCalled();
        expect(props.cleanup).not.toHaveBeenCalled();
        expect(part.node.nodeValue).toBe('');
      }
    });
  });
});

interface GreetProps {
  greet: string;
  name: string;
}

const Greet = createComponent(function Greet({
  name,
  greet,
}: GreetProps): unknown {
  return `${greet}, ${name}!`;
});

interface MemoProps {
  key: unknown;
  value: unknown;
}

const Memo = createComponent(
  function Memo({ value }: MemoProps): unknown {
    return value;
  },
  {
    arePropsEqual: (nextProps, prevProps) => nextProps.key === prevProps.key,
  },
);

interface EnqueueEffectProps {
  callback: (phase: CommitPhase) => void;
  cleanup: (phase: CommitPhase) => void;
}

const EnqueueEffect = createComponent(function EnqueueEffect(
  { callback, cleanup }: EnqueueEffectProps,
  context: RenderContext,
): unknown {
  context.useInsertionEffect(() => {
    callback('mutation');
    return () => {
      cleanup('mutation');
    };
  }, [callback, cleanup]);

  context.useLayoutEffect(() => {
    callback('layout');
    return () => {
      cleanup('layout');
    };
  }, [callback, cleanup]);

  context.useEffect(() => {
    callback('passive');
    return () => {
      cleanup('passive');
    };
  }, [callback, cleanup]);

  return '3 effects are enqueued';
});
