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
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { MockSlot } from '../mocks.js';
import { createRenderSession, createUpdateSession } from '../session-utils.js';
import { createElement } from '../test-utils.js';

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
      const session = createRenderSession();

      component.render(props, session);

      expect(render).toHaveBeenCalledOnce();
      expect(render).toHaveBeenCalledWith(props, session);
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
      const session = createUpdateSession();
      const binding = Greet.resolveBinding(props, part, session);

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
      const session = createUpdateSession();

      SESSION: {
        binding.connect(session);
        session.enqueueCoroutine(binding);
        session.flushSync();

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
      const session = createUpdateSession(Lanes.UserBlockingLane);

      const commitSpy = vi.spyOn(binding, 'commit');

      SESSION1: {
        session.enqueueCoroutine(binding);
        session.enqueueMutationEffect(binding);
        session.flushSync();

        expect(commitSpy).toHaveBeenCalledTimes(1);
        expect(binding.pendingLanes).toBe(Lanes.UserBlockingLane);
        expect(part.node.nodeValue).toBe('100');
      }

      SESSION2: {
        session.enqueueCoroutine(binding);
        session.enqueueMutationEffect(binding);
        session.flushSync();

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
      const tree = createHydrationTree(container);
      const session = createUpdateSession();

      SESSION1: {
        binding.hydrate(tree, session);
        session.enqueueCoroutine(binding);
        session.enqueueMutationEffect(binding);
        session.flushSync();

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
        binding.disconnect(session);
        binding.rollback();

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
      const container = document.createElement('div');
      const tree = createHydrationTree(container);
      const session = createUpdateSession();

      session.enqueueCoroutine(binding);
      session.enqueueMutationEffect(binding);
      session.flushSync();

      expect(() => binding.hydrate(tree, session)).toThrow(HydrationError);
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
      const session = createUpdateSession();

      SESSION1: {
        binding.connect(session);
        session.enqueueMutationEffect(binding);
        session.flushSync();

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
        binding.bind(props2);
        binding.connect(session);
        session.enqueueMutationEffect(binding);
        session.flushSync();

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
      const session = createUpdateSession();

      SESSION1: {
        binding.connect(session);
        session.enqueueMutationEffect(binding);
        session.flushSync();

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
        binding.disconnect(session);
        binding.rollback();
        session.flushSync();

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
