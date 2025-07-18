import { describe, expect, it, vi } from 'vitest';
import { ComponentBinding, component, FunctionComponent } from '@/component.js';
import {
  CommitPhase,
  HydrationError,
  HydrationTree,
  Lanes,
  PartType,
  type RenderContext,
} from '@/core.js';
import { RenderSession } from '@/render-session.js';
import { Runtime } from '@/runtime.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { MockBackend, MockCoroutine, MockSlot } from '../mocks.js';
import { createElement } from '../test-utils.js';

describe('component()', () => {
  it('returns a new DirectiveSpecifier with the component', () => {
    const props = { name: 'foo', greet: 'Hello' };
    const directive = component(Greet, props);

    expect(directive.type).toBeInstanceOf(FunctionComponent);
    expect(directive.value).toBe(props);
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
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

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
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = new Runtime(new MockBackend());
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
        childNode: null,
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
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new ComponentBinding(component, props1, part);
      const runtime = new Runtime(new MockBackend());

      binding.connect(runtime);
      runtime.enqueueMutationEffect(binding);
      runtime.flushSync();

      expect(binding.shouldBind(props1)).toBe(false);
      expect(binding.shouldBind(props2)).toBe(true);
    });
  });

  describe('hydrate()', () => {
    it('hydrates the tree by the value rendered by the component', () => {
      const component = new FunctionComponent(Greet);
      const props = {
        name: 'foo',
        greet: 'Hello',
      };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment('Hello, foo!'),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new ComponentBinding(component, props, part);
      const hydrationRoot = createElement('div', {}, part.node);
      const hydrationTree = new HydrationTree(hydrationRoot);
      const runtime = new Runtime(new MockBackend());

      binding.hydrate(hydrationTree, runtime);
      runtime.enqueueMutationEffect(binding);
      runtime.flushSync();

      expect(binding['_slot']).toBeInstanceOf(MockSlot);
      expect(binding['_slot']).toStrictEqual(
        expect.objectContaining({
          isConnected: true,
          isCommitted: true,
        }),
      );
      expect(binding['_slot']?.part).toBe(part);
      expect(hydrationRoot.innerHTML).toBe('<!--Hello, foo!-->');

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
      expect(hydrationRoot.innerHTML).toBe('<!---->');
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
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new ComponentBinding(component, props, part);
      const hydrationRoot = document.createElement('div');
      const hydrationTree = new HydrationTree(hydrationRoot);
      const runtime = new Runtime(new MockBackend());

      runtime.enqueueCoroutine(binding);
      runtime.enqueueMutationEffect(binding);
      runtime.flushSync();

      expect(() => binding.hydrate(hydrationTree, runtime)).toThrow(
        HydrationError,
      );
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
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new ComponentBinding(component, props1, part);
      const runtime = new Runtime(new MockBackend());

      binding.connect(runtime);
      runtime.enqueueMutationEffect(binding);
      runtime.flushSync();

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
      runtime.flushSync();

      expect(binding['_slot']).toBeInstanceOf(MockSlot);
      expect(binding['_slot']).toStrictEqual(
        expect.objectContaining({
          isConnected: true,
          isCommitted: true,
        }),
      );
      expect(binding['_slot']?.part).toBe(part);
      expect(part.node.nodeValue).toBe('Hello, foo!');
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
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new ComponentBinding(component, props, part);
      const runtime = new Runtime(new MockBackend());

      binding.connect(runtime);
      runtime.enqueueMutationEffect(binding);
      runtime.flushSync();

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
      runtime.flushSync();

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

Memo.shouldSkipUpdate = (nextProps: MemoProps, prevProps: MemoProps): boolean =>
  nextProps.key === prevProps.key;

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
