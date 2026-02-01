import { describe, expect, it, vi } from 'vitest';

import { ComponentBinding, createComponent } from '@/component.js';
import { DirectiveSpecifier } from '@/directive.js';
import {
  CommitPhase,
  createScope,
  Lanes,
  PartType,
  type RenderContext,
} from '@/internal.js';
import { RenderSession } from '@/render-session.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { createRuntime, MockSlot } from '../mocks.js';
import { TestRenderer } from '../test-renderer.js';
import { TestUpdater } from '../test-updater.js';

describe('createComponent()', () => {
  it('returns a directive with props', () => {
    const props = { greet: 'Hello', name: 'foo' };
    const directive = Greet(props) as DirectiveSpecifier<GreetProps>;

    expect(directive).toBeInstanceOf(DirectiveSpecifier);
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
  describe('shouldUpdate()', () => {
    it('returns true if the committed value does not exist', () => {
      const props = { greet: 'Hello', name: 'foo' };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new ComponentBinding(Greet, props, part);

      expect(binding.shouldUpdate(props)).toBe(true);
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
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          session.frame.pendingCoroutines.push(binding);
        });

        expect(binding.shouldUpdate(props1)).toBe(false);
        expect(binding.shouldUpdate(props2)).toBe(true);
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
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate(
          (session) => {
            binding.attach(session);
            session.frame.mutationEffects.push(binding, session.scope.level);
          },
          { priority: 'user-blocking' },
        );

        expect(binding.pendingLanes).toBe(
          Lanes.DefaultLane | Lanes.UserBlockingLane,
        );
        expect(part.node.nodeValue).toBe('100');
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.attach(session);
          session.frame.mutationEffects.push(binding, session.scope.level);
        });

        expect(binding.pendingLanes).toBe(Lanes.NoLanes);
        expect(part.node.nodeValue).toBe('101');
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
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new ComponentBinding(Greet, props1, part);
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          session.frame.mutationEffects.push(binding, session.scope.level);
        });

        expect(binding['_slot']).toBeInstanceOf(MockSlot);
        expect(binding['_slot']).toStrictEqual(
          expect.objectContaining({
            dirty: false,
            committed: true,
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

        expect(binding['_slot']).toBeInstanceOf(MockSlot);
        expect(binding['_slot']).toStrictEqual(
          expect.objectContaining({
            dirty: false,
            committed: true,
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
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new ComponentBinding(EnqueueEffect, props, part);
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          session.frame.mutationEffects.push(binding, session.scope.level);
        });

        expect(binding['_slot']).toBeInstanceOf(MockSlot);
        expect(binding['_slot']).toStrictEqual(
          expect.objectContaining({
            dirty: false,
            committed: true,
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

        expect(binding['_slot']).toBeInstanceOf(MockSlot);
        expect(binding['_slot']).toStrictEqual(
          expect.objectContaining({
            dirty: false,
            committed: false,
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

    it('does not invoke pending effects when the component is detached', () => {
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
      const updater = new TestUpdater();

      SESSION: {
        updater.startUpdate((session) => {
          binding.attach(session);

          session.frame.pendingCoroutines.push({
            name: '',
            pendingLanes: Lanes.DefaultLane,
            scope: createScope(session.scope),
            resume(session) {
              binding.detach(session);
            },
          });
        });

        expect(binding['_slot']).toBeInstanceOf(MockSlot);
        expect(binding['_slot']).toStrictEqual(
          expect.objectContaining({
            dirty: true,
            committed: false,
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
