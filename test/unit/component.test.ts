import { describe, expect, it, vi } from 'vitest';
import { ComponentBinding, createComponent } from '@/component.js';
import { DirectiveSpecifier } from '@/directive.js';
import { createHydrationTree } from '@/hydration.js';
import {
  CommitPhase,
  HydrationError,
  Lanes,
  PartType,
  type RenderContext,
} from '@/internal.js';
import { RenderSession } from '@/render-session.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { MockSlot } from '../mocks.js';
import {
  createElement,
  createRuntime,
  RenderHelper,
  UpdateHelper,
} from '../test-helpers.js';

describe('createComponent()', () => {
  it('returns a directive with props', () => {
    const props = { greet: 'Hello', name: 'foo' };
    const directive = Greet(props) as DirectiveSpecifier<GreetProps>;

    expect(directive).toBeInstanceOf(DirectiveSpecifier);
    expect(directive.type).toBe(Greet);
    expect(directive.value).toBe(props);
  });

  describe('name', () => {
    it('returns the render function name', () => {
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
      const props = {};
      const helper = new RenderHelper();

      helper.startSession((context) => {
        component.render(props, context);
      });

      expect(render).toHaveBeenCalledOnce();
      expect(render).toHaveBeenCalledWith(props, expect.any(RenderSession));
    });
  });

  describe('shouldSkipUpdate()', () => {
    it('returns whether the props is the same with `===` equality', () => {
      const props1 = { greet: 'Hello', name: 'foo' };
      const props2 = { greet: 'Chao', name: 'bar' };

      expect(Greet.shouldSkipUpdate(props1, props1)).toBe(true);
      expect(Greet.shouldSkipUpdate(props1, props2)).toBe(false);
      expect(Greet.shouldSkipUpdate(props2, props1)).toBe(false);
      expect(Greet.shouldSkipUpdate(props2, props2)).toBe(true);
    });

    it.each([
      [{ key: 'foo', value: 1 }, { key: 'foo', value: 1 }, true],
      [{ key: 'foo', value: 1 }, { key: 'bar', value: 2 }, false],
    ])(
      'returns whether the props is the same with custom equality',
      (props1, props2, expandedResult) => {
        expect(Memo.shouldSkipUpdate(props1, props1)).toBe(true);
        expect(Memo.shouldSkipUpdate(props1, props2)).toBe(expandedResult);
        expect(Memo.shouldSkipUpdate(props2, props1)).toBe(expandedResult);
        expect(Memo.shouldSkipUpdate(props2, props2)).toBe(true);
      },
    );
  });

  describe('resolveBinding()', () => {
    it('constructs a new ComponentBinding', () => {
      const props = { greet: 'Hello', name: 'foo' };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = createRuntime();
      const binding = Greet.resolveBinding(props, part, runtime);

      expect(binding.type).toBe(Greet);
      expect(binding.value).toBe(props);
      expect(binding.part).toBe(part);
    });
  });
});

describe('ComponentBinding', () => {
  describe('shouldBind()', () => {
    it('returns true if the committed value does not exist', () => {
      const props = { greet: 'Hello', name: 'foo' };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new ComponentBinding(Greet, props, part);

      expect(binding.shouldBind(props)).toBe(true);
    });

    it('returns true if the committed value is different from the new one', () => {
      const props1 = { greet: 'Hello', name: 'foo' };
      const props2 = { greet: 'Chao', name: 'bar' };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new ComponentBinding(Greet, props1, part);
      const helper = new UpdateHelper();

      SESSION1: {
        helper.startSession((context) => {
          binding.connect(context);
          context.frame.pendingCoroutines.push(binding);
        });

        expect(binding.shouldBind(props1)).toBe(false);
        expect(binding.shouldBind(props2)).toBe(true);
      }
    });
  });

  describe('resume()', () => {
    it('clears pending lanes', async () => {
      const props = {
        initialCount: 100,
      };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new ComponentBinding(Increment, props, part);
      const helper = new UpdateHelper();

      const commitSpy = vi.spyOn(binding, 'commit');

      binding.pendingLanes = Lanes.NoLanes;

      SESSION1: {
        helper.startSession(
          (context) => {
            context.frame.pendingCoroutines.push(binding);
            context.frame.mutationEffects.push(binding);
          },
          { priority: 'user-blocking' },
        );

        expect(commitSpy).toHaveBeenCalledTimes(1);
        expect(binding.pendingLanes).toBe(
          Lanes.DefaultLane | Lanes.UserBlockingLane,
        );
        expect(part.node.nodeValue).toBe('100');
      }

      await Promise.resolve();

      SESSION2: {
        helper.startSession((context) => {
          context.frame.pendingCoroutines.push(binding);
          context.frame.mutationEffects.push(binding);
        });

        expect(commitSpy).toHaveBeenCalledTimes(2);
        expect(binding.pendingLanes).toBe(Lanes.NoLanes);
        expect(part.node.nodeValue).toBe('101');
      }
    });
  });

  describe('hydrate()', () => {
    it('hydrates the tree by the component result', () => {
      const props = {
        name: 'foo',
        greet: 'Hello',
      };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment('Hello, foo!'),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new ComponentBinding(Greet, props, part);
      const container = createElement('div', {}, part.node);
      const target = createHydrationTree(container);
      const helper = new UpdateHelper();

      SESSION1: {
        helper.startSession((context) => {
          binding.hydrate(target, context);
          context.frame.pendingCoroutines.push(binding);
          context.frame.mutationEffects.push(binding);
        });

        expect(binding['_slot']).toBeInstanceOf(MockSlot);
        expect(binding['_slot']).toStrictEqual(
          expect.objectContaining({
            isConnected: true,
            isCommitted: true,
          }),
        );
        expect(binding['_slot']?.part).toBe(part);
        expect(container.innerHTML).toBe('<!--Hello, foo!-->');
      }

      SESSION2: {
        helper.startSession((context) => {
          binding.disconnect(context);
          binding.rollback();
        });

        expect(binding['_slot']).toBeInstanceOf(MockSlot);
        expect(binding['_slot']).toStrictEqual(
          expect.objectContaining({
            isConnected: false,
            isCommitted: false,
          }),
        );
        expect(binding['_slot']?.part).toBe(part);
        expect(container.innerHTML).toBe('<!---->');
      }
    });

    it('should throw the error if the component has already been rendered', () => {
      const props = {
        name: 'foo',
        greet: 'Hello',
      };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new ComponentBinding(Greet, props, part);
      const helper = new UpdateHelper();

      helper.startSession((context) => {
        context.frame.pendingCoroutines.push(binding);
        context.frame.mutationEffects.push(binding);
      });

      expect(() => {
        helper.startSession((context) => {
          const container = document.createElement('div');
          const target = createHydrationTree(container);
          binding.hydrate(target, context);
        });
      }).toThrow(HydrationError);
    });
  });

  describe('connect()', () => {
    it('renders the component', () => {
      const props1 = {
        name: 'foo',
        greet: 'Hello',
      };
      const props2 = {
        name: 'bar',
        greet: 'Chao',
      };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new ComponentBinding(Greet, props1, part);
      const helper = new UpdateHelper();

      SESSION1: {
        helper.startSession((context) => {
          binding.connect(context);
          context.frame.pendingCoroutines.push(binding);
        });

        expect(binding['_slot']).toBeInstanceOf(MockSlot);
        expect(binding['_slot']).toStrictEqual(
          expect.objectContaining({
            isConnected: true,
            isCommitted: true,
          }),
        );
        expect(binding['_slot']?.part).toBe(part);
        expect(part.node.nodeValue).toBe('Hello, foo!');
      }

      SESSION2: {
        helper.startSession((context) => {
          binding.value = props2;
          binding.connect(context);
          context.frame.mutationEffects.push(binding);
        });

        expect(binding['_slot']).toBeInstanceOf(MockSlot);
        expect(binding['_slot']).toStrictEqual(
          expect.objectContaining({
            isConnected: true,
            isCommitted: true,
          }),
        );
        expect(binding['_slot']?.part).toBe(part);
        expect(part.node.nodeValue).toBe('Chao, bar!');
      }
    });
  });

  describe('disconnect()', () => {
    it('cleans effect hooks', () => {
      const props = {
        callback: vi.fn(),
        cleanup: vi.fn(),
      };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new ComponentBinding(EnqueueEffect, props, part);
      const helper = new UpdateHelper();

      SESSION1: {
        helper.startSession((context) => {
          binding.connect(context);
          context.frame.mutationEffects.push(binding);
        });

        expect(binding['_slot']).toBeInstanceOf(MockSlot);
        expect(binding['_slot']).toStrictEqual(
          expect.objectContaining({
            isConnected: true,
            isCommitted: true,
          }),
        );
        expect(binding['_slot']?.part).toBe(part);
        expect(part.node.nodeValue).toBe('3 effects are enqueued');
      }

      SESSION2: {
        helper.startSession((context) => {
          binding.disconnect(context);
          binding.rollback();
        });

        expect(binding['_slot']).toBeInstanceOf(MockSlot);
        expect(binding['_slot']).toStrictEqual(
          expect.objectContaining({
            isConnected: false,
            isCommitted: false,
          }),
        );
        expect(binding['_slot']?.part).toBe(part);
        expect(props.callback).toHaveBeenCalledTimes(3);
        expect(props.callback).toHaveBeenNthCalledWith(1, CommitPhase.Mutation);
        expect(props.callback).toHaveBeenNthCalledWith(2, CommitPhase.Layout);
        expect(props.callback).toHaveBeenNthCalledWith(3, CommitPhase.Passive);
        expect(props.cleanup).toHaveBeenCalledTimes(3);
        expect(props.cleanup).toHaveBeenNthCalledWith(1, CommitPhase.Mutation);
        expect(props.cleanup).toHaveBeenNthCalledWith(2, CommitPhase.Layout);
        expect(props.cleanup).toHaveBeenNthCalledWith(3, CommitPhase.Passive);
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
    shouldSkipUpdate: (nextProps, prevProps) => nextProps.key === prevProps.key,
  },
);

interface IncrementProps {
  initialCount: number;
}

const Increment = createComponent(function Increment(
  { initialCount }: IncrementProps,
  context: RenderContext,
): unknown {
  const [count, setCount] = context.useState(initialCount);

  context.useEffect(() => {
    setCount((count) => count + 1);
  }, []);

  return count;
});

interface EnqueueEffectProps {
  callback: (phase: CommitPhase) => void;
  cleanup: (phase: CommitPhase) => void;
}

const EnqueueEffect = createComponent(function EnqueueEffect(
  { callback, cleanup }: EnqueueEffectProps,
  context: RenderContext,
): unknown {
  context.useInsertionEffect(() => {
    callback(CommitPhase.Mutation);
    return () => {
      cleanup(CommitPhase.Mutation);
    };
  }, [callback, cleanup]);

  context.useLayoutEffect(() => {
    callback(CommitPhase.Layout);
    return () => {
      cleanup(CommitPhase.Layout);
    };
  }, [callback, cleanup]);

  context.useEffect(() => {
    callback(CommitPhase.Passive);
    return () => {
      cleanup(CommitPhase.Passive);
    };
  }, [callback, cleanup]);

  return '3 effects are enqueued';
});
