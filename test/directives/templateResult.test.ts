import { describe, expect, it, vi } from 'vitest';
import {
  TemplateResult,
  TemplateResultBinding,
} from '../../src/directives/templateResult.js';
import { PartType, directiveTag, nameTag } from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import {
  MockRenderHost,
  MockTemplate,
  MockTemplateFragment,
  MockUpdateBlock,
} from '../mocks.js';

describe('Fragment', () => {
  describe('.constructor()', () => {
    it('should construct a new Fragment', () => {
      const template = new MockTemplate();
      const data = {};
      const directive = new TemplateResult(template, data);

      expect(directive.template).toBe(template);
      expect(directive.data).toBe(data);
    });
  });

  describe('[nameTag]', () => {
    it('should return a string represented itself', () => {
      const directive = new TemplateResult(new MockTemplate(), {});
      expect(directive[nameTag]).toBe('TemplateResult(MockTemplate)');
    });
  });

  describe('[directiveTag]()', () => {
    it('should return an instance of TemplateBinding', () => {
      const directive = new TemplateResult(new MockTemplate(), {});
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
      const directive = new TemplateResult(new MockTemplate(), {});
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const updater = new SyncUpdater(new MockRenderHost());

      expect(() => directive[directiveTag](part, updater)).toThrow(
        'TemplateResult directive must be used in a child node,',
      );
    });
  });
});

describe('TemplateBinding', () => {
  describe('.shouldUpdate()', () => {
    it('should return false after initialization', () => {
      const directive = new TemplateResult(new MockTemplate(), {});
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const parent = new MockUpdateBlock();
      const binding = new TemplateResultBinding(directive, part, parent);

      expect(binding.shouldUpdate()).toBe(false);
    });

    it('should return true after an update is requested', () => {
      const directive = new TemplateResult(new MockTemplate(), {});
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const parent = new MockUpdateBlock();
      const binding = new TemplateResultBinding(directive, part, parent);
      const updater = new SyncUpdater(new MockRenderHost());

      binding.connect(updater);
      updater.flush();

      binding.requestUpdate('user-blocking', updater);

      expect(binding.shouldUpdate()).toBe(true);
    });

    it('should return false if the binding is unbound', () => {
      const directive = new TemplateResult(new MockTemplate(), {});
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const parent = new MockUpdateBlock();
      const binding = new TemplateResultBinding(directive, part, parent);
      const updater = new SyncUpdater(new MockRenderHost());

      vi.spyOn(parent, 'isUpdating', 'get').mockReturnValue(true);

      binding.connect(updater);
      updater.flush();

      binding.unbind(updater);
      binding.requestUpdate('user-blocking', updater);

      expect(binding.shouldUpdate()).toBe(false);
    });

    it('should return false if there is a parent being updated', () => {
      const directive = new TemplateResult(new MockTemplate(), {});
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const parent = new MockUpdateBlock();
      const binding = new TemplateResultBinding(directive, part, parent);
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
      const directive = new TemplateResult(new MockTemplate(), {});
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TemplateResultBinding(directive, part, null);
      const state = new MockRenderHost();
      const updater = new SyncUpdater(state);

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
      const directive = new TemplateResult(new MockTemplate(), {});
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TemplateResultBinding(directive, part, null);
      const updater = new SyncUpdater(new MockRenderHost());

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
      const directive = new TemplateResult(new MockTemplate(), {});
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TemplateResultBinding(directive, part, null);
      const updater = new SyncUpdater(new MockRenderHost());

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
      const directive = new TemplateResult(new MockTemplate(), {});
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TemplateResultBinding(directive, part, null);
      const updater = new SyncUpdater(new MockRenderHost());

      binding.requestUpdate('background', updater);

      expect(binding.isUpdating).toBe(false);
      expect(binding.priority).toBe('user-blocking');
      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });

    it('should do nothing if the binding is disconnected', () => {
      const directive = new TemplateResult(new MockTemplate(), {});
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TemplateResultBinding(directive, part, null);
      const updater = new SyncUpdater(new MockRenderHost());

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
      const directive = new TemplateResult(new MockTemplate(), {});
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TemplateResultBinding(directive, part, null);
      const updater = new SyncUpdater(new MockRenderHost());

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
      const directive = new TemplateResult(new MockTemplate(), {});
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TemplateResultBinding(directive, part, null);
      const updater = new SyncUpdater(new MockRenderHost());

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

    it('should mark itself as updating', () => {
      const directive = new TemplateResult(new MockTemplate(), {});
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TemplateResultBinding(directive, part, null);
      const updater = new SyncUpdater(new MockRenderHost());

      binding.connect(updater);
      updater.flush();

      binding.requestUpdate('user-blocking', updater);

      expect(binding.isUpdating).toBe(true);

      updater.flush();

      expect(binding.isUpdating).toBe(false);
    });
  });

  describe('.connect()', () => {
    it('should render the template and mount its fragment', () => {
      const directive = new TemplateResult(new MockTemplate(), {});
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TemplateResultBinding(directive, part, null);
      const updater = new SyncUpdater(new MockRenderHost());
      const fragment = new MockTemplateFragment();
      const startNode = document.createComment('');

      const renderSpy = vi
        .spyOn(directive.template, 'render')
        .mockReturnValue(fragment);
      const mountSpy = vi.spyOn(fragment, 'mount');
      vi.spyOn(fragment, 'startNode', 'get').mockReturnValue(startNode);

      binding.connect(updater);
      updater.flush();

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(directive.data, updater);
      expect(mountSpy).toHaveBeenCalledOnce();
      expect(mountSpy).toHaveBeenCalledWith(part);
      expect(binding.startNode).toBe(startNode);
      expect(binding.endNode).toBe(part.node);
    });

    it('should enqueue the binding as a block with the parent priority', () => {
      const directive = new TemplateResult(new MockTemplate(), {});
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const parent = new MockUpdateBlock();
      const binding = new TemplateResultBinding(directive, part, parent);
      const updater = new SyncUpdater(new MockRenderHost());

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
      const directive = new TemplateResult(new MockTemplate(), {});
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TemplateResultBinding(directive, part, null);
      const updater = new SyncUpdater(new MockRenderHost());

      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      binding.connect(updater);
      binding.connect(updater);

      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(binding);
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();
    });

    it('should cancel the unmount in progress', () => {
      const directive = new TemplateResult(new MockTemplate(), {});
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TemplateResultBinding(directive, part, null);
      const updater = new SyncUpdater(new MockRenderHost());
      const fragment = new MockTemplateFragment();

      const renderSpy = vi
        .spyOn(directive.template, 'render')
        .mockReturnValue(fragment);
      const mountSpy = vi.spyOn(fragment, 'mount');
      const unmountSpy = vi.spyOn(fragment, 'unmount');
      const bindSpy = vi.spyOn(fragment, 'bind');

      binding.connect(updater);
      updater.flush();

      binding.unbind(updater);
      binding.connect(updater);
      updater.flush();

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(directive.data, updater);
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(directive.data, updater);
      expect(mountSpy).toHaveBeenCalledOnce();
      expect(mountSpy).toHaveBeenCalledWith(part);
      expect(unmountSpy).not.toHaveBeenCalled();
    });

    it('should mark itself as dirty', () => {
      const directive = new TemplateResult(new MockTemplate(), {});
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TemplateResultBinding(directive, part, null);
      const updater = new SyncUpdater(new MockRenderHost());

      binding.bind(directive, updater);

      expect(binding.isUpdating).toBe(true);

      updater.flush();

      expect(binding.isUpdating).toBe(false);
    });
  });

  describe('.bind()', () => {
    it('should bind data to the current fragment if that is a renderd from the same template', () => {
      const directive1 = new TemplateResult(new MockTemplate(), {});
      const directive2 = new TemplateResult(new MockTemplate(), {});
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TemplateResultBinding(directive1, part, null);
      const updater = new SyncUpdater(new MockRenderHost());
      const fragment = new MockTemplateFragment();
      const startNode = document.createComment('');

      const renderSpy = vi
        .spyOn(directive1.template, 'render')
        .mockReturnValue(fragment);
      const bindSpy = vi.spyOn(fragment, 'bind');
      const mountSpy = vi.spyOn(fragment, 'mount');
      vi.spyOn(fragment, 'startNode', 'get').mockReturnValue(startNode);

      binding.connect(updater);
      updater.flush();

      binding.bind(directive2, updater);
      updater.flush();

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(directive1.data, updater);
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(directive2.data, updater);
      expect(mountSpy).toHaveBeenCalledOnce();
      expect(mountSpy).toHaveBeenCalledWith(part);
      expect(binding.startNode).toBe(startNode);
      expect(binding.endNode).toBe(part.node);
    });

    it('should unbind data from the current fragment if that is a renderd from a different template', () => {
      const directive1 = new TemplateResult(new MockTemplate(1), {});
      const directive2 = new TemplateResult(new MockTemplate(2), {});
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TemplateResultBinding(directive1, part, null);
      const updater = new SyncUpdater(new MockRenderHost());
      const fragment1 = new MockTemplateFragment();
      const fragment2 = new MockTemplateFragment();
      const startNode1 = document.createComment('');
      const startNode2 = document.createComment('');

      const render1Spy = vi
        .spyOn(directive1.template, 'render')
        .mockReturnValue(fragment1);
      const render2Spy = vi
        .spyOn(directive2.template, 'render')
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
      expect(render1Spy).toHaveBeenCalledWith(directive1.data, updater);
      expect(render2Spy).toHaveBeenCalledOnce();
      expect(render2Spy).toHaveBeenCalledWith(directive2.data, updater);
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

    it('should remount the fragment if it is unmounted', () => {
      const directive = new TemplateResult(new MockTemplate(), {});
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TemplateResultBinding(directive, part, null);
      const updater = new SyncUpdater(new MockRenderHost());
      const fragment = new MockTemplateFragment();
      const startNode = document.createComment('');

      const renderSpy = vi
        .spyOn(directive.template, 'render')
        .mockReturnValue(fragment);
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
      expect(renderSpy).toHaveBeenCalledWith(directive.data, updater);
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(directive.data, updater);
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

    it('should request the mutation only once', () => {
      const directive1 = new TemplateResult(new MockTemplate(1), {});
      const directive2 = new TemplateResult(new MockTemplate(2), {});
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TemplateResultBinding(directive1, part, null);
      const state = new MockRenderHost();
      const updater = new SyncUpdater(state);
      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
        'enqueueMutationEffect',
      );

      binding.connect(updater);
      binding.performUpdate(state, updater);

      binding.bind(directive2, updater);
      binding.performUpdate(state, updater);

      expect(enqueueBlockSpy).toHaveBeenCalledTimes(2);
      expect(enqueueBlockSpy).toHaveBeenNthCalledWith(1, binding);
      expect(enqueueBlockSpy).toHaveBeenNthCalledWith(2, binding);
      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });
  });

  describe('.unbind()', () => {
    it('should unbind data from the current fragment', () => {
      const directive = new TemplateResult(new MockTemplate(), {});
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TemplateResultBinding(directive, part, null);
      const updater = new SyncUpdater(new MockRenderHost());
      const fragment = new MockTemplateFragment();
      const startNode = document.createComment('');

      const renderSpy = vi
        .spyOn(directive.template, 'render')
        .mockReturnValue(fragment);
      const unbindSpy = vi.spyOn(fragment, 'unbind');
      const unmountSpy = vi.spyOn(fragment, 'unmount');
      vi.spyOn(fragment, 'startNode', 'get').mockReturnValue(startNode);

      binding.connect(updater);
      updater.flush();

      binding.unbind(updater);
      updater.flush();

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(directive.data, updater);
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(updater);
      expect(unmountSpy).toHaveBeenCalledOnce();
      expect(unmountSpy).toHaveBeenCalledWith(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
    });

    it('should cancel the update in progress', () => {
      const directive = new TemplateResult(new MockTemplate(), {});
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TemplateResultBinding(directive, part, null);
      const updater = new SyncUpdater(new MockRenderHost());
      const fragment = new MockTemplateFragment();

      const renderSpy = vi
        .spyOn(directive.template, 'render')
        .mockReturnValue(fragment);
      const mountSpy = vi.spyOn(fragment, 'mount');
      const unmountSpy = vi.spyOn(fragment, 'unmount');
      const bindSpy = vi.spyOn(fragment, 'bind');

      binding.connect(updater);
      updater.flush();

      binding.requestUpdate('user-blocking', updater);
      binding.unbind(updater);
      updater.flush();

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(directive.data, updater);
      expect(bindSpy).not.toHaveBeenCalled();
      expect(mountSpy).toHaveBeenCalledOnce();
      expect(mountSpy).toHaveBeenCalledWith(part);
      expect(unmountSpy).toHaveBeenCalledOnce();
      expect(unmountSpy).toHaveBeenCalledWith(part);
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect the current fragment', () => {
      const directive = new TemplateResult(new MockTemplate(), {});
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TemplateResultBinding(directive, part, null);
      const updater = new SyncUpdater(new MockRenderHost());
      const fragment = new MockTemplateFragment();

      const renderSpy = vi
        .spyOn(directive.template, 'render')
        .mockReturnValue(fragment);
      const disconnectSpy = vi.spyOn(fragment, 'disconnect');

      binding.connect(updater);
      updater.flush();
      binding.disconnect();

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(directive.data, updater);
      expect(disconnectSpy).toHaveBeenCalledOnce();
    });

    it('should cancel the update in progress', () => {
      const directive = new TemplateResult(new MockTemplate(), {});
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TemplateResultBinding(directive, part, null);
      const updater = new SyncUpdater(new MockRenderHost());
      const fragment = new MockTemplateFragment();

      const renderSpy = vi
        .spyOn(directive.template, 'render')
        .mockReturnValue(fragment);
      const mountSpy = vi.spyOn(fragment, 'mount');
      const unmountSpy = vi.spyOn(fragment, 'unmount');
      const bindSpy = vi.spyOn(fragment, 'bind');

      binding.connect(updater);
      updater.flush();

      binding.requestUpdate('user-blocking', updater);
      binding.disconnect();
      updater.flush();

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(directive.data, updater);
      expect(bindSpy).not.toHaveBeenCalled();
      expect(mountSpy).toHaveBeenCalledOnce();
      expect(mountSpy).toHaveBeenCalledWith(part);
      expect(unmountSpy).not.toHaveBeenCalled();
    });
  });
});
