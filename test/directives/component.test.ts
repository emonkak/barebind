import { describe, expect, it, vi } from 'vitest';
import { PartType, UpdateContext, directiveTag } from '../../src/baseTypes.js';
import {
  Component,
  ComponentBinding,
  component,
} from '../../src/directives/component.js';
import { EagerTemplateResult } from '../../src/directives/templateResult.js';
import type { RenderContext } from '../../src/renderContext.js';
import { SyncUpdater } from '../../src/updaters/syncUpdater.js';
import {
  MockBlock,
  MockRenderHost,
  MockTemplate,
  MockTemplateView,
} from '../mocks.js';

describe('component()', () => {
  it('should construct a new Component directive', () => {
    const type = () => new EagerTemplateResult(new MockTemplate(), {});
    const props = {};
    const value = component(type, props);

    expect(value.type).toBe(type);
    expect(value.props).toBe(props);
  });
});

describe('Component', () => {
  describe('[Symbol.toStringTag]', () => {
    it('should return a string represented itself', () => {
      const value = new Component(function foo() {
        return new EagerTemplateResult(new MockTemplate(), {});
      }, {});
      expect(value[Symbol.toStringTag]).toBe('Component(foo)');
    });
  });

  describe('[directiveTag]()', () => {
    it('should create a new BlockBinding wrapped in BlockBinding', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = new Component(
        () => new EagerTemplateResult(new MockTemplate(), {}),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = value[directiveTag](part, context);

      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.binding).toBeInstanceOf(ComponentBinding);
    });

    it('should throw an error if the part is not a ChildNodePart', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = new Component(
        () => new EagerTemplateResult(new MockTemplate(), {}),
        {},
      );
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;

      expect(() => value[directiveTag](part, context)).toThrow(
        'Component directive must be used in a child node,',
      );
    });
  });
});

describe('ComponentBinding', () => {
  describe('.connect()', () => {
    it('should not render the template if it is already rendered', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const template = new MockTemplate();
      const values = {};
      const view = new MockTemplateView(values, [document.createComment('')]);
      const value = new Component(
        () => new EagerTemplateResult(template, values),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(value, part);

      const renderSpy = vi.spyOn(template, 'render').mockReturnValueOnce(view);
      const mountSpy = vi.spyOn(view, 'mount');

      binding.connect(context);
      context.flushUpdate();

      binding.connect(context);
      context.flushUpdate();

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(values, context);
      expect(mountSpy).toHaveBeenCalledOnce();
      expect(mountSpy).toHaveBeenCalledWith(part);
      expect(binding.startNode).toBe(view.startNode);
      expect(binding.endNode).toBe(part.node);
    });

    it('should update the block if an update is requested', () => {
      const context = new UpdateContext<RenderContext>(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = new Component<{}, unknown, RenderContext>(
        (_props, context) => {
          context.forceUpdate('user-blocking');
          return new EagerTemplateResult(new MockTemplate(), {});
        },
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(value, part);

      const requstUpdateSpy = vi.spyOn(context.block, 'requestUpdate');

      binding.connect(context);

      expect(requstUpdateSpy).toHaveBeenCalledOnce();
      expect(requstUpdateSpy).toHaveBeenCalledWith('user-blocking', context);
    });

    it('should remount the view if it is unmounted', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const template = new MockTemplate();
      const values = {};
      const view = new MockTemplateView(values, [document.createComment('')]);
      const value = new Component(
        () => new EagerTemplateResult(template, values),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(value, part);

      const renderSpy = vi.spyOn(template, 'render').mockReturnValueOnce(view);
      const connectSpy = vi.spyOn(view, 'connect');
      const bindSpy = vi.spyOn(view, 'bind');
      const unbindSpy = vi.spyOn(view, 'unbind');
      const mountSpy = vi.spyOn(view, 'mount');
      const unmountSpy = vi.spyOn(view, 'unmount');

      binding.connect(context);
      context.flushUpdate();

      binding.unbind(context);
      context.flushUpdate();

      binding.connect(context);
      context.flushUpdate();

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(values, context);
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(values, context);
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
      expect(mountSpy).toHaveBeenCalledTimes(2);
      expect(mountSpy).toHaveBeenCalledWith(part);
      expect(unmountSpy).toHaveBeenCalledOnce();
      expect(unmountSpy).toHaveBeenCalledWith(part);
      expect(binding.startNode).toBe(view.startNode);
      expect(binding.endNode).toBe(part.node);
    });
  });

  describe('.bind()', () => {
    it('should bind values to the current view if it is a renderd from the same template', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const template = new MockTemplate();
      const values1 = {};
      const values2 = {};
      const view = new MockTemplateView(values1, [document.createComment('')]);
      const value1 = new Component(
        () => new EagerTemplateResult(template, values1),
        {},
      );
      const value2 = new Component(
        () => new EagerTemplateResult(template, values2),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(value1, part);

      const renderSpy = vi.spyOn(template, 'render').mockReturnValueOnce(view);
      const connectSpy = vi.spyOn(view, 'connect');
      const bindSpy = vi.spyOn(view, 'bind');
      const mountSpy = vi.spyOn(view, 'mount');

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);
      context.flushUpdate();

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(values1, context);
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(values2, context);
      expect(mountSpy).toHaveBeenCalledOnce();
      expect(mountSpy).toHaveBeenCalledWith(part);
      expect(binding.startNode).toBe(view.startNode);
      expect(binding.endNode).toBe(part.node);
    });

    it('should unbind values from the current view if it is a renderd from a different template', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const template1 = new MockTemplate();
      const template2 = new MockTemplate();
      const template3 = new MockTemplate();
      const values1 = {};
      const values2 = {};
      const values3 = {};
      const view1 = new MockTemplateView(values1, [document.createComment('')]);
      const view2 = new MockTemplateView(values2, [document.createComment('')]);
      const view3 = new MockTemplateView(values3, [document.createComment('')]);
      const value1 = new Component(
        () => new EagerTemplateResult(template1, values1),
        {},
      );
      const value2 = new Component(
        () => new EagerTemplateResult(template2, values2),
        {},
      );
      const value3 = new Component(
        () => new EagerTemplateResult(template3, values3),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(value1, part);

      const render1Spy = vi
        .spyOn(template1, 'render')
        .mockReturnValueOnce(view1);
      const render2Spy = vi
        .spyOn(template2, 'render')
        .mockReturnValueOnce(view2);
      const render3Spy = vi
        .spyOn(template3, 'render')
        .mockReturnValueOnce(view3);
      const connect1Spy = vi.spyOn(view1, 'connect');
      const connect2Spy = vi.spyOn(view2, 'connect');
      const connect3Spy = vi.spyOn(view3, 'connect');
      const unbind1Spy = vi.spyOn(view1, 'unbind');
      const unbind2Spy = vi.spyOn(view2, 'unbind');
      const unbind3Spy = vi.spyOn(view3, 'unbind');
      const mount1Spy = vi.spyOn(view1, 'mount');
      const mount2Spy = vi.spyOn(view2, 'mount');
      const mount3Spy = vi.spyOn(view3, 'mount');
      const unmount1Spy = vi.spyOn(view1, 'unmount');
      const unmount2Spy = vi.spyOn(view2, 'unmount');
      const unmount3Spy = vi.spyOn(view3, 'unmount');

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);
      context.flushUpdate();

      binding.bind(value3, context);
      context.flushUpdate();

      expect(render1Spy).toHaveBeenCalledOnce();
      expect(render1Spy).toHaveBeenCalledWith(values1, context);
      expect(render2Spy).toHaveBeenCalledOnce();
      expect(render2Spy).toHaveBeenCalledWith(values2, context);
      expect(render3Spy).toHaveBeenCalledOnce();
      expect(render3Spy).toHaveBeenCalledWith(values2, context);
      expect(connect1Spy).toHaveBeenCalledOnce();
      expect(connect1Spy).toHaveBeenCalledWith(context);
      expect(connect2Spy).toHaveBeenCalledOnce();
      expect(connect3Spy).toHaveBeenCalledOnce();
      expect(connect3Spy).toHaveBeenCalledWith(context);
      expect(unbind1Spy).toHaveBeenCalledOnce();
      expect(unbind1Spy).toHaveBeenCalledWith(context);
      expect(unbind2Spy).toHaveBeenCalledOnce();
      expect(unbind3Spy).not.toHaveBeenCalled();
      expect(mount1Spy).toHaveBeenCalledOnce();
      expect(mount1Spy).toHaveBeenCalledWith(part);
      expect(mount2Spy).toHaveBeenCalledOnce();
      expect(mount2Spy).toHaveBeenCalledWith(part);
      expect(mount3Spy).toHaveBeenCalledOnce();
      expect(mount3Spy).toHaveBeenCalledWith(part);
      expect(unmount1Spy).toHaveBeenCalledOnce();
      expect(unmount1Spy).toHaveBeenCalledWith(part);
      expect(unmount2Spy).toHaveBeenCalledOnce();
      expect(unmount3Spy).not.toHaveBeenCalled();
      expect(binding.startNode).toBe(view3.startNode);
      expect(binding.endNode).toBe(part.node);
    });

    it('should render the template when it is called without calling connect()', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const template = new MockTemplate();
      const values1 = {};
      const values2 = {};
      const view = new MockTemplateView(values1, [document.createComment('')]);
      const value1 = new Component(
        () => new EagerTemplateResult(template, values1),
        {},
      );
      const value2 = new Component(
        () => new EagerTemplateResult(template, values2),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(value1, part);

      const renderSpy = vi.spyOn(template, 'render').mockReturnValueOnce(view);
      const connectSpy = vi.spyOn(view, 'connect');
      const bindSpy = vi.spyOn(view, 'bind');
      const mountSpy = vi.spyOn(view, 'mount');

      binding.bind(value2, context);
      context.flushUpdate();

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(values2, context);
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(bindSpy).not.toHaveBeenCalled();
      expect(mountSpy).toHaveBeenCalledOnce();
      expect(mountSpy).toHaveBeenCalledWith(part);
      expect(binding.startNode).toBe(view.startNode);
      expect(binding.endNode).toBe(part.node);
    });

    it('should only mount the last rendered view if there is multiple renderings durling a transation', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const values1 = { name: 'foo' };
      const values2 = { name: 'bar' };
      const template1 = new MockTemplate();
      const template2 = new MockTemplate();
      const view1 = new MockTemplateView(values1, [document.createComment('')]);
      const view2 = new MockTemplateView(values2, [document.createComment('')]);
      const value1 = new Component(
        () => new EagerTemplateResult(template1, values1),
        {},
      );
      const value2 = new Component(
        () => new EagerTemplateResult(template2, values2),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(value1, part);

      const render1Spy = vi
        .spyOn(template1, 'render')
        .mockReturnValueOnce(view1);
      const render2Spy = vi
        .spyOn(template2, 'render')
        .mockReturnValueOnce(view2);
      const connect1Spy = vi.spyOn(view1, 'connect');
      const connect2Spy = vi.spyOn(view2, 'connect');
      const bind1Spy = vi.spyOn(view1, 'bind');
      const bind2Spy = vi.spyOn(view2, 'bind');
      const unbind1Spy = vi.spyOn(view1, 'unbind');
      const unbind2Spy = vi.spyOn(view2, 'unbind');
      const mount1Spy = vi.spyOn(view1, 'mount');
      const mount2Spy = vi.spyOn(view2, 'mount');
      const unmount1Spy = vi.spyOn(view1, 'unmount');
      const unmount2Spy = vi.spyOn(view2, 'unmount');

      binding.connect(context);
      binding.bind(value2, context);
      context.flushUpdate();

      expect(render1Spy).toHaveBeenCalledOnce();
      expect(render1Spy).toHaveBeenCalledWith(values1, context);
      expect(render2Spy).toHaveBeenCalledOnce();
      expect(render2Spy).toHaveBeenCalledWith(values2, context);
      expect(connect1Spy).toHaveBeenCalledOnce();
      expect(connect2Spy).toHaveBeenCalledOnce();
      expect(connect2Spy).toHaveBeenCalledWith(context);
      expect(bind1Spy).not.toHaveBeenCalled();
      expect(bind2Spy).not.toHaveBeenCalled();
      expect(unbind1Spy).toHaveBeenCalledOnce();
      expect(unbind1Spy).toHaveBeenCalledWith(context);
      expect(unbind2Spy).not.toHaveBeenCalled();
      expect(mount1Spy).not.toHaveBeenCalled();
      expect(mount2Spy).toHaveBeenCalledOnce();
      expect(mount2Spy).toHaveBeenCalledWith(part);
      expect(unmount1Spy).not.toHaveBeenCalled();
      expect(unmount2Spy).not.toHaveBeenCalled();
      expect(binding.startNode).toBe(view2.startNode);
      expect(binding.endNode).toBe(part.node);
    });

    it('should remount the view if it is unmounted', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const template = new MockTemplate();
      const values = {};
      const view = new MockTemplateView(values, [document.createComment('')]);
      const value = new Component(
        () => new EagerTemplateResult(template, values),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(value, part);

      const renderSpy = vi.spyOn(template, 'render').mockReturnValueOnce(view);
      const connectSpy = vi.spyOn(view, 'connect');
      const bindSpy = vi.spyOn(view, 'bind');
      const unbindSpy = vi.spyOn(view, 'unbind');
      const mountSpy = vi.spyOn(view, 'mount');
      const unmountSpy = vi.spyOn(view, 'unmount');

      binding.connect(context);
      context.flushUpdate();

      binding.unbind(context);
      context.flushUpdate();

      binding.bind(value, context);
      context.flushUpdate();

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(values, context);
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(values, context);
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
      expect(mountSpy).toHaveBeenCalledTimes(2);
      expect(mountSpy).toHaveBeenCalledWith(part);
      expect(unmountSpy).toHaveBeenCalledOnce();
      expect(unmountSpy).toHaveBeenCalledWith(part);
      expect(binding.startNode).toBe(view.startNode);
      expect(binding.endNode).toBe(part.node);
    });

    it('should reuse the view cached from previous renderings', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const template1 = new MockTemplate();
      const template2 = new MockTemplate();
      const template3 = new MockTemplate();
      const values1 = {};
      const values2 = {};
      const values3 = {};
      const view1 = new MockTemplateView(values1, [document.createComment('')]);
      const view2 = new MockTemplateView(values2, [document.createComment('')]);
      const view3 = new MockTemplateView(values3, [document.createComment('')]);
      const type = vi
        .fn()
        .mockReturnValueOnce(new EagerTemplateResult(template1, values1))
        .mockReturnValueOnce(new EagerTemplateResult(template2, values2))
        .mockReturnValueOnce(new EagerTemplateResult(template3, values3))
        .mockReturnValueOnce(new EagerTemplateResult(template1, values3));
      const value = new Component(type, {});
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(value, part);

      const render1Spy = vi.spyOn(template1, 'render').mockReturnValue(view1);
      const render2Spy = vi.spyOn(template2, 'render').mockReturnValue(view2);
      const render3Spy = vi.spyOn(template3, 'render').mockReturnValue(view3);
      const connect1Spy = vi.spyOn(view1, 'connect');
      const connect2Spy = vi.spyOn(view2, 'connect');
      const connect3Spy = vi.spyOn(view3, 'connect');
      const unbind1Spy = vi.spyOn(view1, 'unbind');
      const unbind2Spy = vi.spyOn(view2, 'unbind');
      const unbind3Spy = vi.spyOn(view3, 'unbind');
      const mount1Spy = vi.spyOn(view1, 'mount');
      const mount2Spy = vi.spyOn(view2, 'mount');
      const mount3Spy = vi.spyOn(view3, 'mount');
      const unmount1Spy = vi.spyOn(view1, 'unmount');
      const unmount2Spy = vi.spyOn(view2, 'unmount');
      const unmount3Spy = vi.spyOn(view3, 'unmount');

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value, context);
      context.flushUpdate();

      binding.bind(value, context);
      context.flushUpdate();

      binding.bind(value, context);
      context.flushUpdate();

      expect(render1Spy).toHaveBeenCalledOnce();
      expect(render1Spy).toHaveBeenCalledWith(values1, context);
      expect(render2Spy).toHaveBeenCalledOnce();
      expect(render2Spy).toHaveBeenCalledWith(values2, context);
      expect(render3Spy).toHaveBeenCalledOnce();
      expect(render3Spy).toHaveBeenCalledWith(values3, context);
      expect(connect1Spy).toHaveBeenCalledOnce();
      expect(connect1Spy).toHaveBeenCalledWith(context);
      expect(connect2Spy).toHaveBeenCalledOnce();
      expect(connect2Spy).toHaveBeenCalledWith(context);
      expect(connect3Spy).toHaveBeenCalledOnce();
      expect(connect3Spy).toHaveBeenCalledWith(context);
      expect(unbind1Spy).toHaveBeenCalledOnce();
      expect(unbind1Spy).toHaveBeenCalledWith(context);
      expect(unbind2Spy).toHaveBeenCalledOnce();
      expect(unbind2Spy).toHaveBeenCalledWith(context);
      expect(unbind3Spy).toHaveBeenCalledOnce();
      expect(unbind3Spy).toHaveBeenCalledWith(context);
      expect(mount1Spy).toHaveBeenCalledTimes(2);
      expect(mount1Spy).toHaveBeenCalledWith(part);
      expect(mount2Spy).toHaveBeenCalledOnce();
      expect(mount2Spy).toHaveBeenCalledWith(part);
      expect(mount3Spy).toHaveBeenCalledOnce();
      expect(mount3Spy).toHaveBeenCalledWith(part);
      expect(unmount1Spy).toHaveBeenCalledOnce();
      expect(unmount1Spy).toHaveBeenCalledWith(part);
      expect(unmount2Spy).toHaveBeenCalledOnce();
      expect(unmount2Spy).toHaveBeenCalledWith(part);
      expect(unmount3Spy).toHaveBeenCalledOnce();
      expect(unmount3Spy).toHaveBeenCalledWith(part);
      expect(binding.startNode).toBe(view1.startNode);
      expect(binding.endNode).toBe(part.node);
    });

    it('should clean hooks if the component has been changed', () => {
      const context = new UpdateContext<RenderContext>(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const cleanup1Fn = vi.fn();
      const cleanup2Fn = vi.fn();
      const value1 = new Component<{}, unknown, RenderContext>(
        (_props, context) => {
          context.useEffect(() => cleanup1Fn);
          context.useLayoutEffect(() => cleanup2Fn);
          return new EagerTemplateResult(new MockTemplate(), {});
        },
        {},
      );
      const value2 = new Component<{}, unknown, RenderContext>(
        (_props, context) => {
          context.useEffect(() => cleanup1Fn);
          context.useLayoutEffect(() => cleanup2Fn);
          return new EagerTemplateResult(new MockTemplate(), {});
        },
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(value1, part);

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);
      context.flushUpdate();

      expect(cleanup1Fn).toHaveBeenCalledOnce();
      expect(cleanup2Fn).toHaveBeenCalledOnce();
    });
  });

  describe('.unbind()', () => {
    it('should unmount the memoized view', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const template = new MockTemplate();
      const values = {};
      const view = new MockTemplateView(values);
      const value = new Component(
        () => new EagerTemplateResult(template, values),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(value, part);

      const renderSpy = vi.spyOn(template, 'render').mockReturnValue(view);
      const connectSpy = vi.spyOn(view, 'connect');
      const unbindSpy = vi.spyOn(view, 'unbind');
      const unmountSpy = vi.spyOn(view, 'unmount');

      binding.connect(context);
      context.flushUpdate();

      binding.unbind(context);
      context.flushUpdate();

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(values, context);
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
      expect(unmountSpy).toHaveBeenCalledOnce();
      expect(unmountSpy).toHaveBeenCalledWith(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
    });

    it('should not unmount the memoized view if it do not exist', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const template = new MockTemplate();
      const values = {};
      const view = new MockTemplateView(values);
      const value = new Component(
        () => new EagerTemplateResult(template, values),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(value, part);

      const renderSpy = vi.spyOn(template, 'render').mockReturnValue(view);
      const connectSpy = vi.spyOn(view, 'connect');
      const unbindSpy = vi.spyOn(view, 'unbind');
      const unmountSpy = vi.spyOn(view, 'unmount');

      binding.unbind(context);
      context.flushUpdate();

      expect(renderSpy).not.toHaveBeenCalled();
      expect(connectSpy).not.toHaveBeenCalled();
      expect(unbindSpy).not.toHaveBeenCalled();
      expect(unmountSpy).not.toHaveBeenCalled();
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
    });

    it('should clean hooks', () => {
      const context = new UpdateContext<RenderContext>(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const cleanup1Fn = vi.fn();
      const cleanup2Fn = vi.fn();
      const directive = new Component<{}, unknown, RenderContext>(
        (_props, context) => {
          context.useEffect(() => cleanup1Fn);
          context.useLayoutEffect(() => cleanup2Fn);
          return new EagerTemplateResult(new MockTemplate(), {});
        },
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(directive, part);

      binding.connect(context);
      context.flushUpdate();

      binding.unbind(context);
      context.flushUpdate();

      expect(cleanup1Fn).toHaveBeenCalledOnce();
      expect(cleanup2Fn).toHaveBeenCalledOnce();
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect the current view', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const template = new MockTemplate();
      const values = {};
      const view = new MockTemplateView(values);
      const value = new Component(
        () => new EagerTemplateResult(template, values),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(value, part);

      const renderSpy = vi.spyOn(template, 'render').mockReturnValue(view);
      const disconnectSpy = vi.spyOn(view, 'disconnect');

      binding.connect(context);
      context.flushUpdate();

      binding.disconnect(context);

      expect(context.isPending()).toBe(false);
      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(values, context);
      expect(disconnectSpy).toHaveBeenCalledOnce();
    });

    it('should clean hooks', () => {
      const context = new UpdateContext<RenderContext>(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn();
      const cleanup3 = vi.fn();
      const cleanup4 = vi.fn();
      const effect1 = vi.fn(() => cleanup1);
      const effect2 = vi.fn(() => cleanup2);
      const effect3 = vi.fn(() => cleanup3);
      const effect4 = vi.fn(() => cleanup4);
      const effect5 = vi.fn();
      const value = new Component<{}, unknown, RenderContext>(
        (_props, context) => {
          context.useEffect(effect1);
          context.useInsertionEffect(effect2);
          context.useLayoutEffect(effect3);
          context.useEffect(effect4);
          context.useEffect(effect5);
          return new EagerTemplateResult(new MockTemplate(), {});
        },
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      binding.disconnect(context);
      context.flushUpdate();

      const effectInvocationCallOrders = [
        effect2,
        effect3,
        effect1,
        effect4,
        effect5,
      ].map((spy) => spy.mock.invocationCallOrder[0]);
      const cleanupInvocationCallOrders = [
        cleanup2,
        cleanup3,
        cleanup4,
        cleanup1,
      ].map((spy) => spy.mock.invocationCallOrder[0]);

      expect(effect1).toHaveBeenCalledOnce();
      expect(effect2).toHaveBeenCalledOnce();
      expect(effect3).toHaveBeenCalledOnce();
      expect(effect4).toHaveBeenCalledOnce();
      expect(effect5).toHaveBeenCalledOnce();
      expect(cleanup1).toHaveBeenCalledOnce();
      expect(cleanup2).toHaveBeenCalledOnce();
      expect(cleanup3).toHaveBeenCalledOnce();
      expect(effectInvocationCallOrders).toStrictEqual(
        effectInvocationCallOrders.toSorted(),
      );
      expect(cleanupInvocationCallOrders).toStrictEqual(
        cleanupInvocationCallOrders.toSorted(),
      );
    });

    it('should cancel mounting', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const template = new MockTemplate();
      const values = {};
      const view = new MockTemplateView(values);
      const value = new Component(
        () => new EagerTemplateResult(template, values),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(value, part);

      const renderSpy = vi.spyOn(template, 'render').mockReturnValueOnce(view);
      const connectSpy = vi.spyOn(view, 'connect');
      const bindSpy = vi.spyOn(view, 'bind');
      const mountSpy = vi.spyOn(view, 'mount');

      binding.connect(context);
      binding.disconnect(context);
      context.flushUpdate();

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(mountSpy).not.toHaveBeenCalled();

      binding.bind(value, context);
      context.flushUpdate();

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(values, context);
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(values, context);
      expect(mountSpy).toHaveBeenCalledOnce();
      expect(mountSpy).toHaveBeenCalledWith(part);
    });
  });
});
