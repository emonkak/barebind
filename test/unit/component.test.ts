import { describe, expect, it, vi } from 'vitest';
import { shallowEqual } from '@/compare.js';
import {
  ComponentBinding,
  type ComponentFunction,
  component,
  FunctionComponent,
  memo,
} from '@/component.js';
import {
  CommitPhase,
  HydrationError,
  Lanes,
  PartType,
  type RenderContext,
} from '@/core.js';
import { createHydrationTree } from '@/hydration.js';
import { Runtime } from '@/runtime.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { MockBackend, MockSlot } from '../mocks.js';
import { createSession } from '../session-utils.js';
import { createElement } from '../test-utils.js';

describe('component()', () => {
  it('returns a new DirectiveSpecifier with the component function', () => {
    const props = { name: 'foo', greet: 'Hello' };
    const directive = component(Greet, props);

    expect(directive.type).toBeInstanceOf(FunctionComponent);
    expect(directive.value).toBe(props);
  });
});

describe('memo()', () => {
  it('set a property comparison Function to the component function', () => {
    const componentFn: ComponentFunction<{}> = (_props: {}) => null;

    expect(memo(componentFn)).toBe(componentFn);
    expect(componentFn.shouldSkipUpdate).toBe(shallowEqual);
  });
});

describe('FunctionComponent', () => {
  describe('name', () => {
    it('returns the component function name', () => {
      const component = new FunctionComponent(Greet);

      expect(component.name).toBe(Greet.name);
    });
  });

  describe('equals()', () => {
    it('returns true if the component type is the same', () => {
      const component = new FunctionComponent(Greet);

      expect(component.equals(component)).toBe(true);
      expect(component.equals(new FunctionComponent(Greet))).toBe(true);
      expect(component.equals(new FunctionComponent(() => {}))).toBe(false);
    });
  });

  describe('render()', () => {
    it('invokes the component function with props', () => {
      const componentFn = vi.fn(Greet);
      const component = new FunctionComponent(componentFn);
      const props = {
        greet: 'Hello',
        name: 'foo',
      };
      const session = createSession();

      component.render(props, session);

      expect(componentFn).toHaveBeenCalledOnce();
      expect(componentFn).toHaveBeenCalledWith(props, session);
    });
  });

  describe('shouldSkipUpdate()', () => {
    it('returns whether the props is the same', () => {
      const component = new FunctionComponent(Greet);
      const props1 = { greet: 'Hello', name: 'foo' };
      const props2 = { greet: 'Chao', name: 'bar' };

      expect(component.shouldSkipUpdate(props1, props1)).toBe(true);
      expect(component.shouldSkipUpdate(props1, props2)).toBe(false);
      expect(component.shouldSkipUpdate(props2, props1)).toBe(false);
      expect(component.shouldSkipUpdate(props2, props2)).toBe(true);
    });

    it.each([
      [{ key: 'foo', value: 1 }, { key: 'foo', value: 1 }, true],
      [{ key: 'foo', value: 1 }, { key: 'bar', value: 2 }, false],
    ])(
      'returns the result of shouldSkipUpdate() if it is definied in the function',
      (props1, props2, expandedResult) => {
        const component = new FunctionComponent(Memo);

        expect(component.shouldSkipUpdate(props1, props1)).toBe(true);
        expect(component.shouldSkipUpdate(props1, props2)).toBe(expandedResult);
        expect(component.shouldSkipUpdate(props2, props1)).toBe(expandedResult);
        expect(component.shouldSkipUpdate(props2, props2)).toBe(true);
      },
    );
  });

  describe('resolveBinding()', () => {
    it('constructs a new ComponentBinding', () => {
      const component = new FunctionComponent(Greet);
      const props = { greet: 'Hello', name: 'foo' };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = Runtime.create(new MockBackend());
      const binding = component.resolveBinding(props, part, runtime);

      expect(binding.type).toBe(component);
      expect(binding.value).toBe(props);
      expect(binding.part).toBe(part);
    });
  });
});

describe('ComponentBinding', () => {
  describe('shouldBind()', () => {
    it('returns true if the committed value does not exist', () => {
      const component = new FunctionComponent(Greet);
      const props = { greet: 'Hello', name: 'foo' };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new ComponentBinding(component, props, part);

      expect(binding.shouldBind(props)).toBe(true);
    });

    it('returns true if the committed value is different from the new one', () => {
      const component = new FunctionComponent(Greet);
      const props1 = { greet: 'Hello', name: 'foo' };
      const props2 = { greet: 'Chao', name: 'bar' };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new ComponentBinding(component, props1, part);
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
      const component = new FunctionComponent(Greet);
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
      const binding = new ComponentBinding(component, props, part);
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
        expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
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
      const component = new FunctionComponent(Greet);
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
      const binding = new ComponentBinding(component, props, part);
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
      const component = new FunctionComponent(Greet);
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
      const binding = new ComponentBinding(component, props, part);
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
      const component = new FunctionComponent(Greet);
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
      const binding = new ComponentBinding(component, props1, part);
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
      const component = new FunctionComponent(EnqueueEffect);
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
      const binding = new ComponentBinding(component, props, part);
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

function Greet({ name, greet }: GreetProps): unknown {
  return `${greet}, ${name}!`;
}

interface MemoProps {
  key: unknown;
  value: unknown;
}

function Memo({ value }: MemoProps): unknown {
  return value;
}

memo(Memo, (nextProps, prevProps) => nextProps.key === prevProps.key);

interface EnqueueEffectProps {
  callback: (phase: CommitPhase) => void;
  cleanup: (phase: CommitPhase) => void;
}

function EnqueueEffect(
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
}
