import { describe, expect, it, vi } from 'vitest';
import {
  ComponentBinding,
  ComponentDirective,
  component,
  defineComponent,
} from '../src/component.js';
import type { RenderContext } from '../src/directive.js';
import { ALL_LANES } from '../src/hook.js';
import { HydrationTree } from '../src/hydration.js';
import { PartType } from '../src/part.js';
import { RenderEngine } from '../src/renderEngine.js';
import { UpdateEngine } from '../src/updateEngine.js';
import { MockCoroutine, MockRenderHost } from './mocks.js';
import { createElement } from './testUtils.js';

interface HookEffect {
  callback: () => void;
  cleanup: () => void;
}

describe('component()', () => {
  it('returns a directive element with the component', () => {
    const props: ParentProps = { name: 'foo', greet: 'Hello' };
    const element = component(Parent, props);

    expect(element.directive).toBe(component(Parent, props).directive);
    expect(element.directive).toBeInstanceOf(ComponentDirective);
    expect(element.value).toBe(props);
  });
});

describe('defineComponent()', () => {
  it('memoizes the component by the component function', () => {
    const component = defineComponent(Parent);

    expect(defineComponent(Parent)).toBe(component);
  });
});

describe('ComponentDirective', () => {
  describe('name', () => {
    it('returns the component function name', () => {
      const component = new ComponentDirective(Parent);

      expect(component.name).toBe(Parent.name);
    });
  });

  describe('render()', () => {
    it('invokes the component function with props', () => {
      const componentFn = vi.fn(Parent);
      const component = new ComponentDirective(componentFn);
      const props: ParentProps = {
        name: 'foo',
        greet: 'Hello',
      };
      const context = new RenderEngine(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new UpdateEngine(new MockRenderHost()),
      );

      component.render(props, context);

      expect(componentFn).toHaveBeenCalledOnce();
      expect(componentFn).toHaveBeenCalledWith(props, context);
    });
  });

  describe('shouldUpdate()', () => {
    it('returns whether the props is not same', () => {
      const component = new ComponentDirective(Parent);
      const props1: ParentProps = { name: 'foo', greet: 'Hello' };
      const props2: ParentProps = { name: 'foo', greet: 'Hello' };

      expect(component.shouldUpdate(props1, props1)).toBe(false);
      expect(component.shouldUpdate(props1, props2)).toBe(true);
      expect(component.shouldUpdate(props2, props1)).toBe(true);
      expect(component.shouldUpdate(props2, props2)).toBe(false);
    });

    it.each([
      [{ key: 'one', value: 'foo' }, { key: 'one', value: 'foo' }, false],
      [{ key: 'one', value: 'foo' }, { key: 'two', value: 'bar' }, true],
    ])(
      'returns the result of shouldUpdate() if it is definied in the function',
      (props1, props2, expandedResult) => {
        const component = new ComponentDirective(Memo);

        expect(component.shouldUpdate(props1, props1)).toBe(false);
        expect(component.shouldUpdate(props1, props2)).toBe(expandedResult);
        expect(component.shouldUpdate(props2, props1)).toBe(expandedResult);
        expect(component.shouldUpdate(props2, props2)).toBe(false);
      },
    );
  });

  describe('resolveBinding()', () => {
    it('constructs a new ComponentBinding', () => {
      const component = new ComponentDirective(Parent);
      const props: ParentProps = { name: 'foo', greet: 'Hello' };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const context = new UpdateEngine(new MockRenderHost());
      const binding = component.resolveBinding(props, part, context);

      expect(binding.directive).toBe(component);
      expect(binding.value).toBe(props);
      expect(binding.part).toBe(part);
    });
  });
});

describe('ComponentBinding', () => {
  describe('shouldBind()', () => {
    it('returns true if the committed value does not exist', () => {
      const component = new ComponentDirective(Parent);
      const props: ParentProps = { name: 'foo', greet: 'Hello' };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const binding = new ComponentBinding(component, props, part);

      expect(binding.shouldBind(props)).toBe(true);
    });

    it('returns true if the committed value is different from the new one', () => {
      const component = new ComponentDirective(Parent);
      const props1 = { name: 'foo', greet: 'Hello' };
      const props2 = { name: 'bar', greet: 'Hello' };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const binding = new ComponentBinding(component, props1, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      context.enqueueMutationEffect(binding);
      context.flushSync();

      expect(binding.shouldBind(props1)).toBe(false);
      expect(binding.shouldBind(props2)).toBe(true);
    });
  });

  describe('hydrate()', () => {
    it('hydrates the tree by the value rendered by the component', () => {
      const component = new ComponentDirective(Parent);
      const props: ParentProps = {
        name: 'foo',
        greet: 'Hello',
      };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const container = createElement(
        'div',
        {},
        createElement(
          'div',
          {},
          ', ',
          createElement('strong', {}, ''),
          '!',
          document.createComment(''),
        ),
        document.createComment(''),
      );
      const binding = new ComponentBinding(component, props, part);
      const hydrationTree = new HydrationTree(container);
      const context = new UpdateEngine(new MockRenderHost());

      binding.hydrate(hydrationTree, context);
      context.enqueueMutationEffect(binding);
      context.flushSync();

      expect(binding['_slot']).toStrictEqual(
        expect.objectContaining({
          isConnected: true,
          isCommitted: true,
        }),
      );
      expect(binding['_slot']?.part).toStrictEqual(part);
      expect(container.innerHTML).toBe(
        '<div>Hello, <strong>foo</strong>!<!----></div><!---->',
      );

      binding.disconnect(context);
      binding.rollback(context);
      context.flushSync();

      expect(binding['_slot']).toStrictEqual(
        expect.objectContaining({
          isConnected: false,
          isCommitted: false,
        }),
      );
      expect(binding['_slot']?.part).toStrictEqual(part);
      expect(container.innerHTML).toBe('<!---->');
    });
  });

  describe('connect()', () => {
    it('renders the component', () => {
      const component = new ComponentDirective(Parent);
      const passiveEffect = createHookEffect();
      const layoutEffect = createHookEffect();
      const mutationEffect = createHookEffect();
      const props1 = {
        name: 'foo',
        greet: 'Hello',
        passiveEffect,
        layoutEffect,
        mutationEffect,
      };
      const props2 = {
        name: 'bar',
        greet: 'Chao',
        passiveEffect,
        layoutEffect,
        mutationEffect,
      };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const container = createElement('div', {}, part.node);
      const binding = new ComponentBinding(component, props1, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      context.enqueueMutationEffect(binding);
      context.flushSync();

      expect(binding['_slot']).toStrictEqual(
        expect.objectContaining({
          isConnected: true,
          isCommitted: true,
        }),
      );
      expect(binding['_slot']?.part).toStrictEqual(part);
      expect(passiveEffect.callback).toHaveBeenCalledOnce();
      expect(layoutEffect.callback).toHaveBeenCalledOnce();
      expect(mutationEffect.callback).toHaveBeenCalledOnce();
      expect(passiveEffect.cleanup).not.toHaveBeenCalled();
      expect(layoutEffect.cleanup).not.toHaveBeenCalled();
      expect(mutationEffect.cleanup).not.toHaveBeenCalled();
      expect(container.innerHTML).toBe(
        '<div>Hello, <strong>foo</strong>!<!----></div><!---->',
      );

      binding.bind(props2);
      binding.connect(context);
      context.enqueueMutationEffect(binding);
      context.flushSync();

      expect(binding['_slot']).toStrictEqual(
        expect.objectContaining({
          isConnected: true,
          isCommitted: true,
        }),
      );
      expect(binding['_slot']?.part).toStrictEqual(part);
      expect(passiveEffect.callback).toHaveBeenCalledOnce();
      expect(layoutEffect.callback).toHaveBeenCalledOnce();
      expect(mutationEffect.callback).toHaveBeenCalledOnce();
      expect(passiveEffect.cleanup).not.toHaveBeenCalled();
      expect(layoutEffect.cleanup).not.toHaveBeenCalled();
      expect(mutationEffect.cleanup).not.toHaveBeenCalled();
      expect(container.innerHTML).toBe(
        '<div>Chao, <strong>bar</strong>!<!----></div><!---->',
      );

      binding.disconnect(context);
      binding.rollback(context);
      context.flushSync();

      expect(binding['_slot']).toStrictEqual(
        expect.objectContaining({
          isConnected: false,
          isCommitted: false,
        }),
      );
      expect(binding['_slot']?.part).toStrictEqual(part);
      expect(passiveEffect.callback).toHaveBeenCalledOnce();
      expect(layoutEffect.callback).toHaveBeenCalledOnce();
      expect(mutationEffect.callback).toHaveBeenCalledOnce();
      expect(passiveEffect.cleanup).toHaveBeenCalledOnce();
      expect(layoutEffect.cleanup).toHaveBeenCalledOnce();
      expect(mutationEffect.cleanup).toHaveBeenCalledOnce();
      expect(container.innerHTML).toBe('<!---->');
    });
  });
});

interface ParentProps {
  name: string;
  greet: string;
  passiveEffect?: HookEffect;
  layoutEffect?: HookEffect;
  mutationEffect?: HookEffect;
}

function Parent(
  { name, greet, passiveEffect, layoutEffect, mutationEffect }: ParentProps,
  context: RenderContext,
): unknown {
  context.useEffect(() => {
    passiveEffect?.callback();
    return () => {
      passiveEffect?.cleanup();
    };
  }, [passiveEffect]);

  context.useLayoutEffect(() => {
    layoutEffect?.callback();
    return () => {
      layoutEffect?.cleanup();
    };
  }, [layoutEffect]);

  context.useInsertionEffect(() => {
    mutationEffect?.callback();
    return () => {
      mutationEffect?.cleanup();
    };
  }, [mutationEffect]);

  context.setContextValue('greet', greet);

  return context.html`<div><${component(Child, { name })}></div>`;
}

interface ChildProps {
  name: string;
}

function Child({ name }: ChildProps, context: RenderContext): unknown {
  const greet = context.getContextValue('greet');

  return context.html`${greet}, <strong>${name}</strong>!`;
}

interface MemoProps {
  key: unknown;
  value: unknown;
}

function Memo({ value }: MemoProps, _context: RenderContext): unknown {
  return value;
}

Memo.shouldUpdate = (nextProps: MemoProps, prevProps: MemoProps): boolean =>
  nextProps.key !== prevProps.key;

function createHookEffect(): HookEffect {
  return {
    callback: vi.fn(),
    cleanup: vi.fn(),
  };
}
