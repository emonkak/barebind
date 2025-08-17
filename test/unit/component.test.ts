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
import { Runtime } from '@/runtime.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { MockBackend, MockSlot } from '../mocks.js';
import { createSession } from '../session-utils.js';
import { createElement } from '../test-utils.js';

describe('createComponent()', () => {
  describe('name', () => {
    it('returns the render function name', () => {
      function MyComponent() {
        return null;
      }

      expect(createComponent(MyComponent).name).toBe(MyComponent.name);
    });
  });

  describe('()', () => {
    it('returns a directive with props', () => {
      const props = { greet: 'Hello', name: 'foo' };
      const directive = Greet(props) as DirectiveSpecifier<GreetProps>;

      expect(directive).toBeInstanceOf(DirectiveSpecifier);
      expect(directive.type).toBe(Greet);
      expect(directive.value).toBe(props);
    });
  });

  describe('render()', () => {
    it('invokes the render function with props', () => {
      const render = vi.fn(() => null);
      const component = createComponent(render);
      const props = {};
      const session = createSession();

      component.render(props, session);

      expect(render).toHaveBeenCalledOnce();
      expect(render).toHaveBeenCalledWith(props, session);
    });
  });

  describe('shouldSkipUpdate()', () => {
    it('returns whether the props is the same with Object.is equality', () => {
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
      const runtime = Runtime.create(new MockBackend());
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
      const runtime = Runtime.create(new MockBackend());

      binding.connect(runtime);
      runtime.enqueueMutationEffect(binding);
      runtime.flushSync(Lanes.UserBlockingLane);

      expect(binding.shouldBind(props1)).toBe(false);
      expect(binding.shouldBind(props2)).toBe(true);
    });
  });

  describe('resume()', () => {
    it('clear pending lanes', async () => {
      const props = {
        greet: 'Hello',
        name: 'foo',
      };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new ComponentBinding(Greet, props, part);
      const runtime = Runtime.create(new MockBackend());

      const enqueueMutationEffectSpy = vi.spyOn(
        runtime,
        'enqueueMutationEffect',
      );

      SESSION1: {
        binding.suspend(Lanes.UserBlockingLane, runtime);

        expect(binding.pendingLanes).toBe(Lanes.UserBlockingLane);

        runtime.enqueueCoroutine(binding);
        runtime.flushSync(Lanes.UserBlockingLane);

        expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
        expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding['_slot']);
        expect(binding.pendingLanes).toBe(Lanes.NoLanes);
        expect(part.node.nodeValue).toBe('Hello, foo!');
      }

      SESSION2: {
        binding.suspend(Lanes.UserBlockingLane, runtime);

        expect(binding.pendingLanes).toBe(Lanes.UserBlockingLane);

        runtime.enqueueCoroutine(binding);
        runtime.flushSync(Lanes.UserBlockingLane);

        expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
        expect(binding.pendingLanes).toBe(Lanes.NoLanes);
        expect(part.node.nodeValue).toBe('Hello, foo!');
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
      const runtime = Runtime.create(new MockBackend());

      binding.hydrate(tree, runtime);
      runtime.enqueueMutationEffect(binding);
      runtime.flushSync(Lanes.NoLanes);

      expect(binding['_slot']).toBeInstanceOf(MockSlot);
      expect(binding['_slot']).toStrictEqual(
        expect.objectContaining({
          isConnected: true,
          isCommitted: true,
        }),
      );
      expect(binding['_slot']?.part).toBe(part);
      expect(container.innerHTML).toBe('<!--Hello, foo!-->');

      binding.disconnect(runtime);
      binding.rollback(runtime);

      expect(binding['_slot']).toBeInstanceOf(MockSlot);
      expect(binding['_slot']).toStrictEqual(
        expect.objectContaining({
          isConnected: false,
          isCommitted: false,
        }),
      );
      expect(binding['_slot']?.part).toBe(part);
      expect(container.innerHTML).toBe('<!---->');
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
      const runtime = Runtime.create(new MockBackend());

      runtime.enqueueCoroutine(binding);
      runtime.enqueueMutationEffect(binding);
      runtime.flushSync(Lanes.UserBlockingLane);

      expect(() => binding.hydrate(tree, runtime)).toThrow(HydrationError);
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
      const runtime = Runtime.create(new MockBackend());

      binding.connect(runtime);
      runtime.enqueueMutationEffect(binding);
      runtime.flushSync(Lanes.UserBlockingLane);

      expect(binding['_slot']).toBeInstanceOf(MockSlot);
      expect(binding['_slot']).toStrictEqual(
        expect.objectContaining({
          isConnected: true,
          isCommitted: true,
        }),
      );
      expect(binding['_slot']?.part).toBe(part);
      expect(part.node.nodeValue).toBe('Hello, foo!');

      binding.bind(props2);
      binding.connect(runtime);
      runtime.enqueueMutationEffect(binding);
      runtime.flushSync(Lanes.UserBlockingLane);

      expect(binding['_slot']).toBeInstanceOf(MockSlot);
      expect(binding['_slot']).toStrictEqual(
        expect.objectContaining({
          isConnected: true,
          isCommitted: true,
        }),
      );
      expect(binding['_slot']?.part).toBe(part);
      expect(part.node.nodeValue).toBe('Chao, bar!');
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
      const runtime = Runtime.create(new MockBackend());

      binding.connect(runtime);
      runtime.enqueueMutationEffect(binding);
      runtime.flushSync(Lanes.UserBlockingLane);

      expect(binding['_slot']).toBeInstanceOf(MockSlot);
      expect(binding['_slot']).toStrictEqual(
        expect.objectContaining({
          isConnected: true,
          isCommitted: true,
        }),
      );
      expect(binding['_slot']?.part).toBe(part);
      expect(part.node.nodeValue).toBe('3 effects are enqueued');

      binding.disconnect(runtime);
      binding.rollback(runtime);
      runtime.flushSync(Lanes.UserBlockingLane);

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
