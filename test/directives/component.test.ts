import { describe, expect, it, vi } from 'vitest';
import {
  ComponentBinding,
  component as componentDirective,
} from '../../src/directives/component.js';
import { TemplateResult } from '../../src/directives/templateResult.js';
import { HookType, PartType, directiveTag, nameTag } from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import {
  type MockRenderContext,
  MockRenderHost,
  MockTemplate,
  MockTemplateFragment,
  MockUpdateBlock,
} from '../mocks.js';

describe('component()', () => {
  it('should construct a new Component', () => {
    const component = () => new TemplateResult(new MockTemplate(), {});
    const props = {};
    const directive = componentDirective(component, props);

    expect(directive.component).toBe(component);
    expect(directive.props).toBe(props);
  });
});

describe('Component', () => {
  describe('[nameTag]', () => {
    it('should return a string represented itself', () => {
      const directive = componentDirective(function foo() {
        return new TemplateResult(new MockTemplate(), {});
      }, {});
      expect(directive[nameTag]).toBe('Component(foo)');
    });
  });

  describe('[directiveTag]()', () => {
    it('should return an instance of ComponentBinding', () => {
      const directive = componentDirective(
        () => new TemplateResult(new MockTemplate(), {}),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockRenderHost());
      const parent = new MockUpdateBlock();

      vi.spyOn(updater, 'getCurrentBlock').mockReturnValue(parent);

      const binding = directive[directiveTag](part, updater);

      expect(binding.value).toBe(directive);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.isUpdating).toBe(false);
      expect(binding.parent).toBe(parent);
      expect(binding.priority).toBe('user-blocking');
    });

    it('should throw an error if the part is not a ChildNodePart', () => {
      const directive = componentDirective(
        () => new TemplateResult(new MockTemplate(), {}),
        {},
      );
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const updater = new SyncUpdater(new MockRenderHost());

      expect(() => directive[directiveTag](part, updater)).toThrow(
        'Component directive must be used in a child node,',
      );
    });
  });
});

describe('ComponentBinding', () => {
  describe('.shouldUpdate()', () => {
    it('should return false after initialization', () => {
      const directive = componentDirective(
        () => new TemplateResult(new MockTemplate(), {}),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const parent = new MockUpdateBlock();
      const binding = new ComponentBinding(directive, part, parent);

      expect(binding.shouldUpdate()).toBe(false);
    });

    it('should return true after an update is requested', () => {
      const directive = componentDirective(
        () => new TemplateResult(new MockTemplate(), {}),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const parent = new MockUpdateBlock();
      const binding = new ComponentBinding(directive, part, parent);
      const updater = new SyncUpdater(new MockRenderHost());

      binding.connect(updater);
      updater.flush();

      binding.requestUpdate('user-blocking', updater);

      expect(binding.shouldUpdate()).toBe(true);
    });

    it('should return false if the binding is unbound', () => {
      const directive = componentDirective(
        () => new TemplateResult(new MockTemplate(), {}),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const parent = new MockUpdateBlock();
      const binding = new ComponentBinding(directive, part, parent);
      const updater = new SyncUpdater(new MockRenderHost());

      binding.connect(updater);
      updater.flush();

      binding.unbind(updater);
      binding.requestUpdate('user-blocking', updater);

      expect(binding.shouldUpdate()).toBe(false);
    });

    it('should return false if there is a parent being updated', () => {
      const directive = componentDirective(
        () => new TemplateResult(new MockTemplate(), {}),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const parent = new MockUpdateBlock();
      const binding = new ComponentBinding(directive, part, parent);
      const updater = new SyncUpdater(new MockRenderHost());

      vi.spyOn(parent, 'isUpdating', 'get').mockReturnValue(true);

      binding.connect(updater);
      updater.flush();

      binding.requestUpdate('user-blocking', updater);

      expect(binding.shouldUpdate()).toBe(false);
    });
  });

  describe('.cancelUpdate()', () => {
    it('should cancel the scheduled update', () => {
      const template = new MockTemplate();
      const data = {};
      const directive = componentDirective(
        () => new TemplateResult(template, data),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(directive, part, null);
      const host = new MockRenderHost();
      const updater = new SyncUpdater(host);

      binding.connect(updater);
      updater.flush();

      binding.requestUpdate('user-visible', updater);
      binding.cancelUpdate();

      expect(binding.isUpdating).toBe(false);
      expect(binding.priority).toBe('user-visible');
    });
  });

  describe('.requestUpdate()', () => {
    it('should schdule the update', () => {
      const template = new MockTemplate();
      const data = {};
      const directive = componentDirective(
        () => new TemplateResult(template, data),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(directive, part, null);
      const host = new MockRenderHost();
      const updater = new SyncUpdater(host);

      binding.connect(updater);
      updater.flush();

      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      binding.requestUpdate('user-visible', updater);

      expect(binding.isUpdating).toBe(true);
      expect(binding.priority).toBe('user-visible');
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(binding);
      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
    });

    it('should reschedule the update if given higher priority', () => {
      const template = new MockTemplate();
      const data = {};
      const directive = componentDirective(
        () => new TemplateResult(template, data),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(directive, part, null);
      const host = new MockRenderHost();
      const updater = new SyncUpdater(host);

      binding.connect(updater);
      updater.flush();

      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      binding.requestUpdate('user-visible', updater);
      binding.requestUpdate('user-blocking', updater);

      expect(binding.isUpdating).toBe(true);
      expect(binding.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).toHaveBeenCalledTimes(2);
      expect(enqueueBlockSpy).toHaveBeenNthCalledWith(1, binding);
      expect(enqueueBlockSpy).toHaveBeenNthCalledWith(2, binding);
      expect(scheduleUpdateSpy).toHaveBeenCalledTimes(2);
    });

    it('should do nothing if the binding is not connected', () => {
      const template = new MockTemplate();
      const data = {};
      const directive = componentDirective(
        () => new TemplateResult(template, data),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(directive, part, null);
      const host = new MockRenderHost();
      const updater = new SyncUpdater(host);

      binding.requestUpdate('background', updater);

      expect(binding.isUpdating).toBe(false);
      expect(binding.priority).toBe('user-blocking');
      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });

    it('should do nothing if the binding is disconnected', () => {
      const template = new MockTemplate();
      const data = {};
      const directive = componentDirective(
        () => new TemplateResult(template, data),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(directive, part, null);
      const host = new MockRenderHost();
      const updater = new SyncUpdater(host);

      binding.connect(updater);
      updater.flush();

      binding.disconnect();
      binding.requestUpdate('background', updater);

      expect(binding.isUpdating).toBe(false);
      expect(binding.priority).toBe('user-blocking');
      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });

    it('should do nothing if the binding is unbound', () => {
      const template = new MockTemplate();
      const data = {};
      const directive = componentDirective(
        () => new TemplateResult(template, data),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(directive, part, null);
      const host = new MockRenderHost();
      const updater = new SyncUpdater(host);

      binding.connect(updater);
      updater.flush();

      binding.unbind(updater);
      updater.flush();

      binding.requestUpdate('background', updater);

      expect(binding.isUpdating).toBe(false);
      expect(binding.priority).toBe('user-blocking');
      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });

    it('should do nothing if an update is already scheduled', () => {
      const template = new MockTemplate();
      const data = {};
      const directive = componentDirective(
        () => new TemplateResult(template, data),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(directive, part, null);
      const host = new MockRenderHost();
      const updater = new SyncUpdater(host);

      binding.connect(updater);
      updater.flush();

      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      binding.requestUpdate('user-blocking', updater);
      binding.requestUpdate('background', updater);

      expect(binding.isUpdating).toBe(true);
      expect(binding.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(binding);
      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
    });
  });

  describe('.connect()', () => {
    it('should hyrate the template returned form the component and mount its fragment', () => {
      const template = new MockTemplate();
      const data = {};
      const directive = componentDirective(
        () => new TemplateResult(template, data),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(directive, part, null);
      const host = new MockRenderHost();
      const updater = new SyncUpdater(host);
      const fragment = new MockTemplateFragment();
      const startNode = document.createComment('');

      const renderSpy = vi.spyOn(template, 'render').mockReturnValue(fragment);
      const mountSpy = vi.spyOn(fragment, 'mount');
      vi.spyOn(fragment, 'startNode', 'get').mockReturnValue(startNode);

      binding.connect(updater);
      updater.flush();

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(data, updater);
      expect(mountSpy).toHaveBeenCalledOnce();
      expect(mountSpy).toHaveBeenCalledWith(part);
      expect(binding.startNode).toBe(startNode);
      expect(binding.endNode).toBe(part.node);
    });

    it('should enqueue the binding as a block with the parent priority', () => {
      const template = new MockTemplate();
      const data = {};
      const directive = componentDirective(
        () => new TemplateResult(template, data),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const parent = new MockUpdateBlock();
      const binding = new ComponentBinding(directive, part, parent);
      const host = new MockRenderHost();
      const updater = new SyncUpdater(host);

      const getPrioritySpy = vi
        .spyOn(parent, 'priority', 'get')
        .mockReturnValue('user-visible');
      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      binding.connect(updater);
      updater.flush();

      expect(getPrioritySpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(binding);
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();
      expect(binding.priority).toBe('user-visible');
    });

    it('should do nothing if an update is already scheduled', () => {
      const template = new MockTemplate();
      const data = {};
      const directive = componentDirective(
        () => new TemplateResult(template, data),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(directive, part, null);
      const host = new MockRenderHost();
      const updater = new SyncUpdater(host);

      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      binding.connect(updater);
      binding.connect(updater);

      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(binding);
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();
    });

    it('should cancel the unmount in progress', () => {
      const template = new MockTemplate();
      const data = {};
      const directive = componentDirective(
        () => new TemplateResult(template, data),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(directive, part, null);
      const host = new MockRenderHost();
      const updater = new SyncUpdater(host);
      const fragment = new MockTemplateFragment();

      const renderSpy = vi.spyOn(template, 'render').mockReturnValue(fragment);
      const mountSpy = vi.spyOn(fragment, 'mount');
      const unmountSpy = vi.spyOn(fragment, 'unmount');
      const bindSpy = vi.spyOn(fragment, 'bind');

      binding.connect(updater);
      updater.flush();

      binding.unbind(updater);
      binding.connect(updater);
      updater.flush();

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(data, updater);
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(data, updater);
      expect(mountSpy).toHaveBeenCalledOnce();
      expect(mountSpy).toHaveBeenCalledWith(part);
      expect(unmountSpy).not.toHaveBeenCalled();
    });

    it('should mark itself as updating', () => {
      const template = new MockTemplate();
      const data = {};
      const directive = componentDirective(
        () => new TemplateResult(template, data),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(directive, part, null);
      const host = new MockRenderHost();
      const updater = new SyncUpdater(host);

      binding.bind(directive, updater);

      expect(binding.isUpdating).toBe(true);

      updater.flush();

      expect(binding.isUpdating).toBe(false);
    });
  });

  describe('.bind()', () => {
    it('should bind data to the current fragment if that fragment is a renderd from the same template', () => {
      const template1 = new MockTemplate();
      const template2 = new MockTemplate();
      const data1 = {};
      const data2 = {};
      const directive1 = componentDirective(
        () => new TemplateResult(template1, data1),
        {},
      );
      const directive2 = componentDirective(
        () => new TemplateResult(template2, data2),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(directive1, part, null);
      const host = new MockRenderHost();
      const updater = new SyncUpdater(host);
      const fragment = new MockTemplateFragment();
      const startNode = document.createComment('');

      const renderSpy = vi.spyOn(template1, 'render').mockReturnValue(fragment);
      const bindSpy = vi.spyOn(fragment, 'bind');
      const mountSpy = vi.spyOn(fragment, 'mount');
      vi.spyOn(fragment, 'startNode', 'get').mockReturnValue(startNode);

      binding.connect(updater);
      updater.flush();

      binding.bind(directive2, updater);
      updater.flush();

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(data1, updater);
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(data2, updater);
      expect(mountSpy).toHaveBeenCalledOnce();
      expect(mountSpy).toHaveBeenCalledWith(part);
      expect(binding.startNode).toBe(startNode);
      expect(binding.endNode).toBe(part.node);
    });

    it('should unbind data from the current fragment if that is a renderd from a different template', () => {
      const template1 = new MockTemplate(1);
      const template2 = new MockTemplate(2);
      const data1 = {};
      const data2 = {};
      const directive1 = componentDirective(
        () => new TemplateResult(template1, data1),
        {},
      );
      const directive2 = componentDirective(
        () => new TemplateResult(template2, data2),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(directive1, part, null);
      const host = new MockRenderHost();
      const updater = new SyncUpdater(host);
      const fragment1 = new MockTemplateFragment();
      const fragment2 = new MockTemplateFragment();
      const startNode1 = document.createComment('');
      const startNode2 = document.createComment('');

      const render1Spy = vi
        .spyOn(template1, 'render')
        .mockReturnValue(fragment1);
      const render2Spy = vi
        .spyOn(template2, 'render')
        .mockReturnValue(fragment2);
      const unbind1Spy = vi.spyOn(fragment1, 'unbind');
      const unbind2Spy = vi.spyOn(fragment2, 'unbind');
      const mount1Spy = vi.spyOn(fragment1, 'mount');
      const mount2Spy = vi.spyOn(fragment2, 'mount');
      const unmount1Spy = vi.spyOn(fragment1, 'unmount');
      const unmount2Spy = vi.spyOn(fragment2, 'unmount');
      vi.spyOn(fragment1, 'startNode', 'get').mockReturnValue(startNode1);
      vi.spyOn(fragment2, 'startNode', 'get').mockReturnValue(startNode2);

      binding.connect(updater);
      updater.flush();

      binding.bind(directive2, updater);
      updater.flush();

      expect(render1Spy).toHaveBeenCalledOnce();
      expect(render1Spy).toHaveBeenCalledWith(data1, updater);
      expect(render2Spy).toHaveBeenCalledOnce();
      expect(render2Spy).toHaveBeenCalledWith(data2, updater);
      expect(unbind1Spy).toHaveBeenCalledOnce();
      expect(unbind1Spy).toHaveBeenCalledWith(updater);
      expect(unbind2Spy).not.toHaveBeenCalled();
      expect(mount1Spy).toHaveBeenCalledOnce();
      expect(mount1Spy).toHaveBeenCalledWith(part);
      expect(mount2Spy).toHaveBeenCalledOnce();
      expect(mount2Spy).toHaveBeenCalledWith(part);
      expect(unmount1Spy).toHaveBeenCalledOnce();
      expect(unmount1Spy).toHaveBeenCalledWith(part);
      expect(unmount2Spy).not.toHaveBeenCalled();
      expect(binding.startNode).toBe(startNode2);
      expect(binding.endNode).toBe(part.node);
    });

    it('should unbind data from the current fragment if that is a renderd from a different template', () => {
      const template1 = new MockTemplate(1);
      const template2 = new MockTemplate(2);
      const template3 = new MockTemplate(3);
      const data1 = {};
      const data2 = {};
      const data3 = {};
      const directive1 = componentDirective(
        () => new TemplateResult(template1, data1),
        {},
      );
      const directive2 = componentDirective(
        () => new TemplateResult(template2, data2),
        {},
      );
      const directive3 = componentDirective(
        () => new TemplateResult(template3, data3),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(directive1, part, null);
      const host = new MockRenderHost();
      const updater = new SyncUpdater(host);
      const fragment1 = new MockTemplateFragment();
      const fragment2 = new MockTemplateFragment();
      const fragment3 = new MockTemplateFragment();
      const startNode1 = document.createComment('');
      const startNode2 = document.createComment('');
      const startNode3 = document.createComment('');

      const render1Spy = vi
        .spyOn(template1, 'render')
        .mockReturnValue(fragment1);
      const render2Spy = vi
        .spyOn(template2, 'render')
        .mockReturnValue(fragment2);
      const render3Spy = vi
        .spyOn(template3, 'render')
        .mockReturnValue(fragment3);
      const unbind1Spy = vi.spyOn(fragment1, 'unbind');
      const unbind2Spy = vi.spyOn(fragment2, 'unbind');
      const unbind3Spy = vi.spyOn(fragment3, 'unbind');
      const mount1Spy = vi.spyOn(fragment1, 'mount');
      const mount2Spy = vi.spyOn(fragment2, 'mount');
      const mount3Spy = vi.spyOn(fragment3, 'mount');
      const unmount1Spy = vi.spyOn(fragment1, 'unmount');
      const unmount2Spy = vi.spyOn(fragment2, 'unmount');
      const unmount3Spy = vi.spyOn(fragment3, 'unmount');
      vi.spyOn(fragment1, 'startNode', 'get').mockReturnValue(startNode1);
      vi.spyOn(fragment2, 'startNode', 'get').mockReturnValue(startNode2);
      vi.spyOn(fragment3, 'startNode', 'get').mockReturnValue(startNode3);

      binding.connect(updater);
      updater.flush();

      binding.bind(directive2, updater);
      updater.flush();

      binding.bind(directive3, updater);
      updater.flush();

      expect(render1Spy).toHaveBeenCalledOnce();
      expect(render1Spy).toHaveBeenCalledWith(data1, updater);
      expect(render2Spy).toHaveBeenCalledOnce();
      expect(render2Spy).toHaveBeenCalledWith(data2, updater);
      expect(render3Spy).toHaveBeenCalledOnce();
      expect(render3Spy).toHaveBeenCalledWith(data2, updater);
      expect(unbind1Spy).toHaveBeenCalledOnce();
      expect(unbind1Spy).toHaveBeenCalledWith(updater);
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
      expect(binding.startNode).toBe(startNode3);
      expect(binding.endNode).toBe(part.node);
    });

    it('should remount the fragment if it is unmounted', () => {
      const template = new MockTemplate();
      const data = {};
      const directive = componentDirective(
        () => new TemplateResult(template, data),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(directive, part, null);
      const host = new MockRenderHost();
      const updater = new SyncUpdater(host);
      const fragment = new MockTemplateFragment();
      const startNode = document.createComment('');

      const renderSpy = vi.spyOn(template, 'render').mockReturnValue(fragment);
      const bindSpy = vi.spyOn(fragment, 'bind');
      const unbindSpy = vi.spyOn(fragment, 'unbind');
      const mountSpy = vi.spyOn(fragment, 'mount');
      const unmountSpy = vi.spyOn(fragment, 'unmount');
      vi.spyOn(fragment, 'startNode', 'get').mockReturnValue(startNode);

      binding.connect(updater);
      updater.flush();

      binding.unbind(updater);
      updater.flush();

      binding.bind(directive, updater);
      updater.flush();

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(data, updater);
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(data, updater);
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(updater);
      expect(mountSpy).toHaveBeenCalledTimes(2);
      expect(mountSpy).toHaveBeenNthCalledWith(1, part);
      expect(mountSpy).toHaveBeenNthCalledWith(2, part);
      expect(unmountSpy).toHaveBeenCalledOnce();
      expect(unmountSpy).toHaveBeenCalledWith(part);
      expect(binding.startNode).toBe(startNode);
      expect(binding.endNode).toBe(part.node);
    });

    it('should reuse the cached fragment', () => {
      const template1 = new MockTemplate(1);
      const template2 = new MockTemplate(2);
      const data1 = {};
      const data2 = {};
      const directive1 = componentDirective(
        () => new TemplateResult(template1, data1),
        {},
      );
      const directive2 = componentDirective(
        () => new TemplateResult(template2, data2),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(directive1, part, null);
      const host = new MockRenderHost();
      const updater = new SyncUpdater(host);
      const fragment1 = new MockTemplateFragment();
      const fragment2 = new MockTemplateFragment();
      const startNode1 = document.createComment('');
      const startNode2 = document.createComment('');

      const render1Spy = vi
        .spyOn(template1, 'render')
        .mockReturnValue(fragment1);
      const render2Spy = vi
        .spyOn(template2, 'render')
        .mockReturnValue(fragment2);
      const unbind1Spy = vi.spyOn(fragment1, 'unbind');
      const unbind2Spy = vi.spyOn(fragment2, 'unbind');
      const mount1Spy = vi.spyOn(fragment1, 'mount');
      const mount2Spy = vi.spyOn(fragment2, 'mount');
      const unmount1Spy = vi.spyOn(fragment1, 'unmount');
      const unmount2Spy = vi.spyOn(fragment2, 'unmount');
      vi.spyOn(fragment1, 'startNode', 'get').mockReturnValue(startNode1);
      vi.spyOn(fragment2, 'startNode', 'get').mockReturnValue(startNode2);

      binding.connect(updater);
      updater.flush();

      binding.bind(directive2, updater);
      updater.flush();

      binding.bind(directive1, updater);
      updater.flush();

      expect(render1Spy).toHaveBeenCalledOnce();
      expect(render1Spy).toHaveBeenCalledWith(data1, updater);
      expect(render2Spy).toHaveBeenCalledOnce();
      expect(render2Spy).toHaveBeenCalledWith(data2, updater);
      expect(unbind1Spy).toHaveBeenCalledOnce();
      expect(unbind1Spy).toHaveBeenCalledWith(updater);
      expect(unbind2Spy).toHaveBeenCalled();
      expect(unbind2Spy).toHaveBeenCalledWith(updater);
      expect(mount1Spy).toHaveBeenCalledTimes(2);
      expect(mount1Spy).toHaveBeenNthCalledWith(1, part);
      expect(mount1Spy).toHaveBeenNthCalledWith(2, part);
      expect(mount2Spy).toHaveBeenCalledOnce();
      expect(mount2Spy).toHaveBeenCalledWith(part);
      expect(unmount1Spy).toHaveBeenCalledOnce();
      expect(unmount1Spy).toHaveBeenCalledWith(part);
      expect(unmount2Spy).toHaveBeenCalledOnce();
      expect(unmount2Spy).toHaveBeenCalledWith(part);
      expect(binding.startNode).toBe(startNode1);
      expect(binding.endNode).toBe(part.node);
    });

    it('should clean hooks if the component has been changed', () => {
      const cleanup = vi.fn();
      const directive1 = componentDirective(
        (_props, { hooks }: MockRenderContext) => {
          hooks.push({
            type: HookType.Effect,
            cleanup,
            dependencies: [],
          });
          hooks.push({
            type: HookType.Finalizer,
          });
          return new TemplateResult(new MockTemplate(), {});
        },
        {},
      );
      const directive2 = componentDirective(
        (_props, { hooks }: MockRenderContext) => {
          hooks.push({
            type: HookType.Effect,
            cleanup,
            dependencies: [],
          });
          hooks.push({
            type: HookType.Finalizer,
          });
          return new TemplateResult(new MockTemplate(), {});
        },
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(directive1, part, null);
      const updater = new SyncUpdater(new MockRenderHost());

      binding.connect(updater);
      updater.flush();

      binding.bind(directive2, updater);
      updater.flush();

      expect(cleanup).toHaveBeenCalledOnce();
    });

    it('should request the mutation only once', () => {
      const directive1 = componentDirective(
        () => new TemplateResult(new MockTemplate(1), {}),
        {},
      );
      const directive2 = componentDirective(
        () => new TemplateResult(new MockTemplate(2), {}),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(directive1, part, null);
      const host = new MockRenderHost();
      const updater = new SyncUpdater(host);
      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
        'enqueueMutationEffect',
      );

      binding.connect(updater);
      binding.performUpdate(host, updater);

      binding.bind(directive2, updater);
      binding.performUpdate(host, updater);

      expect(enqueueBlockSpy).toHaveBeenCalledTimes(2);
      expect(enqueueBlockSpy).toHaveBeenNthCalledWith(1, binding);
      expect(enqueueBlockSpy).toHaveBeenNthCalledWith(2, binding);
      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });
  });

  describe('.unbind()', () => {
    it('should unmount the memoized fragment', () => {
      const template = new MockTemplate();
      const data = {};
      const directive = componentDirective(
        () => new TemplateResult(template, data),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(directive, part, null);
      const host = new MockRenderHost();
      const updater = new SyncUpdater(host);
      const fragment = new MockTemplateFragment();
      const startNode = document.createComment('');

      const renderSpy = vi.spyOn(template, 'render').mockReturnValue(fragment);
      const unbindSpy = vi.spyOn(fragment, 'unbind');
      const unmountSpy = vi.spyOn(fragment, 'unmount');
      vi.spyOn(fragment, 'startNode', 'get').mockReturnValue(startNode);

      binding.connect(updater);
      updater.flush();

      binding.unbind(updater);
      updater.flush();

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(data, updater);
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(updater);
      expect(unmountSpy).toHaveBeenCalledOnce();
      expect(unmountSpy).toHaveBeenCalledWith(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
    });

    it('should cancel the update in progress', () => {
      const template = new MockTemplate();
      const data = {};
      const directive = componentDirective(
        () => new TemplateResult(template, data),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(directive, part, null);
      const host = new MockRenderHost();
      const updater = new SyncUpdater(host);
      const fragment = new MockTemplateFragment();

      const renderSpy = vi.spyOn(template, 'render').mockReturnValue(fragment);
      const mountSpy = vi.spyOn(fragment, 'mount');
      const unmountSpy = vi.spyOn(fragment, 'unmount');
      const bindSpy = vi.spyOn(fragment, 'bind');

      binding.connect(updater);
      updater.flush();

      binding.requestUpdate('user-blocking', updater);
      binding.unbind(updater);
      updater.flush();

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(data, updater);
      expect(bindSpy).not.toHaveBeenCalled();
      expect(mountSpy).toHaveBeenCalledOnce();
      expect(mountSpy).toHaveBeenCalledWith(part);
      expect(unmountSpy).toHaveBeenCalledOnce();
      expect(unmountSpy).toHaveBeenCalledWith(part);
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect the current fragment', () => {
      const template = new MockTemplate();
      const data = {};
      const directive = componentDirective(
        () => new TemplateResult(template, data),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(directive, part, null);
      const host = new MockRenderHost();
      const updater = new SyncUpdater(host);
      const fragment = new MockTemplateFragment();

      const renderSpy = vi.spyOn(template, 'render').mockReturnValue(fragment);
      const disconnectSpy = vi.spyOn(fragment, 'disconnect');

      binding.connect(updater);
      updater.flush();
      binding.disconnect();

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(data, updater);
      expect(disconnectSpy).toHaveBeenCalledOnce();
    });

    it('should cancel the update in progress', () => {
      const template = new MockTemplate();
      const data = {};
      const directive = componentDirective(
        () => new TemplateResult(template, data),
        {},
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ComponentBinding(directive, part, null);
      const host = new MockRenderHost();
      const updater = new SyncUpdater(host);
      const fragment = new MockTemplateFragment();

      const renderSpy = vi.spyOn(template, 'render').mockReturnValue(fragment);
      const mountSpy = vi.spyOn(fragment, 'mount');
      const unmountSpy = vi.spyOn(fragment, 'unmount');
      const bindSpy = vi.spyOn(fragment, 'bind');

      binding.connect(updater);
      updater.flush();

      binding.requestUpdate('user-blocking', updater);
      binding.disconnect();
      updater.flush();

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(data, updater);
      expect(bindSpy).not.toHaveBeenCalled();
      expect(mountSpy).toHaveBeenCalledOnce();
      expect(mountSpy).toHaveBeenCalledWith(part);
      expect(unmountSpy).not.toHaveBeenCalled();
    });
  });
});
