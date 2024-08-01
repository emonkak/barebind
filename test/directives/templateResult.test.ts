import { describe, expect, it, vi } from 'vitest';
import {
  TemplateResult,
  TemplateResultBinding,
} from '../../src/directives/templateResult.js';
import {
  PartType,
  createUpdateContext,
  directiveTag,
  nameTag,
} from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import {
  MockBlock,
  MockTemplate,
  MockTemplateFragment,
  MockUpdateHost,
} from '../mocks.js';

describe('TemplateResult', () => {
  describe('[nameTag]', () => {
    it('should return a string represented itself', () => {
      const value = new TemplateResult(new MockTemplate(), {});

      expect(value[nameTag]).toBe('TemplateResult(MockTemplate)');
    });
  });

  describe('[directiveTag]()', () => {
    it('should return a new TemplateBinding directive', () => {
      const value = new TemplateResult(new MockTemplate(), {});
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const currentBlock = new MockBlock();
      const context = createUpdateContext(host, updater, currentBlock);

      const binding = value[directiveTag](part, context);

      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
    });

    it('should throw an error if the part is not a ChildNodePart', () => {
      const value = new TemplateResult(new MockTemplate(), {});
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      expect(() => value[directiveTag](part, context)).toThrow(
        'TemplateResult directive must be used in a child node,',
      );
    });
  });
});

describe('TemplateResultBinding', () => {
  describe('.connect()', () => {
    it('should not render the template if it is already rendered', () => {
      const value = new TemplateResult(new MockTemplate(), {});
      const fragment = new MockTemplateFragment(value.data, [
        document.createComment(''),
      ]);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TemplateResultBinding(value, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      const renderSpy = vi
        .spyOn(value.template, 'render')
        .mockReturnValue(fragment);
      const connectSpy = vi.spyOn(fragment, 'connect');
      const mountSpy = vi.spyOn(fragment, 'mount');

      binding.connect(context);
      updater.flushUpdate(host);

      binding.connect(context);
      updater.flushUpdate(host);

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(value.data, context);
      expect(connectSpy).toHaveBeenCalledTimes(2);
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(mountSpy).toHaveBeenCalledOnce();
      expect(mountSpy).toHaveBeenCalledWith(part);
      expect(binding.startNode).toBe(fragment.startNode);
      expect(binding.endNode).toBe(part.node);
    });
  });

  describe('.bind()', () => {
    it('should bind data to the current fragment if it is a renderd from the same template', () => {
      const template = new MockTemplate();
      const directive1 = new TemplateResult(template, {});
      const directive2 = new TemplateResult(template, {});
      const fragment = new MockTemplateFragment(directive1.data, [
        document.createComment(''),
      ]);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TemplateResultBinding(directive1, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      const renderSpy = vi
        .spyOn(directive1.template, 'render')
        .mockReturnValueOnce(fragment);
      const connectSpy = vi.spyOn(fragment, 'connect');
      const bindSpy = vi.spyOn(fragment, 'bind');
      const mountSpy = vi.spyOn(fragment, 'mount');

      binding.connect(context);
      updater.flushUpdate(host);

      binding.bind(directive2, context);
      updater.flushUpdate(host);

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(directive1.data, context);
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(directive2.data, context);
      expect(mountSpy).toHaveBeenCalledOnce();
      expect(mountSpy).toHaveBeenCalledWith(part);
      expect(binding.startNode).toBe(fragment.startNode);
      expect(binding.endNode).toBe(part.node);
    });

    it('should unbind data from the current fragment if it is a renderd from a different template', () => {
      const directive1 = new TemplateResult(new MockTemplate(), {});
      const directive2 = new TemplateResult(new MockTemplate(), {});
      const fragment1 = new MockTemplateFragment(directive1.data, [
        document.createComment(''),
      ]);
      const fragment2 = new MockTemplateFragment(directive2.data, [
        document.createComment(''),
      ]);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TemplateResultBinding(directive1, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      const render1Spy = vi
        .spyOn(directive1.template, 'render')
        .mockReturnValue(fragment1);
      const render2Spy = vi
        .spyOn(directive2.template, 'render')
        .mockReturnValue(fragment2);
      const connect1Spy = vi.spyOn(fragment1, 'connect');
      const connect2Spy = vi.spyOn(fragment2, 'connect');
      const unbind1Spy = vi.spyOn(fragment1, 'unbind');
      const unbind2Spy = vi.spyOn(fragment2, 'unbind');
      const mount1Spy = vi.spyOn(fragment1, 'mount');
      const mount2Spy = vi.spyOn(fragment2, 'mount');
      const unmount1Spy = vi.spyOn(fragment1, 'unmount');
      const unmount2Spy = vi.spyOn(fragment2, 'unmount');

      binding.connect(context);
      updater.flushUpdate(host);

      binding.bind(directive2, context);
      updater.flushUpdate(host);

      expect(render1Spy).toHaveBeenCalledOnce();
      expect(render1Spy).toHaveBeenCalledWith(directive1.data, context);
      expect(render2Spy).toHaveBeenCalledOnce();
      expect(render2Spy).toHaveBeenCalledWith(directive2.data, context);
      expect(connect1Spy).toHaveBeenCalledOnce();
      expect(connect1Spy).toHaveBeenCalledWith(context);
      expect(connect2Spy).toHaveBeenCalled();
      expect(connect2Spy).toHaveBeenCalledWith(context);
      expect(unbind1Spy).toHaveBeenCalledOnce();
      expect(unbind1Spy).toHaveBeenCalledWith(context);
      expect(unbind2Spy).not.toHaveBeenCalled();
      expect(mount1Spy).toHaveBeenCalledOnce();
      expect(mount1Spy).toHaveBeenCalledWith(part);
      expect(mount2Spy).toHaveBeenCalledOnce();
      expect(mount2Spy).toHaveBeenCalledWith(part);
      expect(unmount1Spy).toHaveBeenCalledOnce();
      expect(unmount1Spy).toHaveBeenCalledWith(part);
      expect(unmount2Spy).not.toHaveBeenCalled();
      expect(binding.startNode).toBe(fragment2.startNode);
      expect(binding.endNode).toBe(part.node);
    });

    it('should render the template when it is called without calling connect()', () => {
      const directive1 = new TemplateResult(new MockTemplate(), {});
      const directive2 = new TemplateResult(new MockTemplate(), {});
      const fragment = new MockTemplateFragment(directive1.data, [
        document.createComment(''),
      ]);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TemplateResultBinding(directive1, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      const renderSpy = vi
        .spyOn(directive2.template, 'render')
        .mockReturnValueOnce(fragment);
      const connectSpy = vi.spyOn(fragment, 'connect');
      const bindSpy = vi.spyOn(fragment, 'bind');
      const mountSpy = vi.spyOn(fragment, 'mount');

      binding.bind(directive2, context);
      updater.flushUpdate(host);

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(directive2.data, context);
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(bindSpy).not.toHaveBeenCalled();
      expect(mountSpy).toHaveBeenCalledOnce();
      expect(mountSpy).toHaveBeenCalledWith(part);
      expect(binding.startNode).toBe(fragment.startNode);
      expect(binding.endNode).toBe(part.node);
    });

    it('should only mount the last rendered fragment if there is multiple renderings durling a transation', () => {
      const directive1 = new TemplateResult(new MockTemplate(), {});
      const directive2 = new TemplateResult(new MockTemplate(), {});
      const fragment1 = new MockTemplateFragment(directive1.data, [
        document.createComment(''),
      ]);
      const fragment2 = new MockTemplateFragment(directive2.data, [
        document.createComment(''),
      ]);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TemplateResultBinding(directive1, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      const render1Spy = vi
        .spyOn(directive1.template, 'render')
        .mockReturnValue(fragment1);
      const render2Spy = vi
        .spyOn(directive2.template, 'render')
        .mockReturnValue(fragment2);
      const connect1Spy = vi.spyOn(fragment1, 'connect');
      const connect2Spy = vi.spyOn(fragment2, 'connect');
      const unbind1Spy = vi.spyOn(fragment1, 'unbind');
      const unbind2Spy = vi.spyOn(fragment2, 'unbind');
      const mount1Spy = vi.spyOn(fragment1, 'mount');
      const mount2Spy = vi.spyOn(fragment2, 'mount');
      const unmount1Spy = vi.spyOn(fragment1, 'unmount');
      const unmount2Spy = vi.spyOn(fragment2, 'unmount');

      binding.connect(context);
      binding.bind(directive2, context);
      updater.flushUpdate(host);

      expect(render1Spy).toHaveBeenCalledOnce();
      expect(render1Spy).toHaveBeenCalledWith(directive1.data, context);
      expect(render2Spy).toHaveBeenCalledOnce();
      expect(render2Spy).toHaveBeenCalledWith(directive2.data, context);
      expect(connect1Spy).toHaveBeenCalledOnce();
      expect(connect1Spy).toHaveBeenCalledWith(context);
      expect(connect2Spy).toHaveBeenCalled();
      expect(connect2Spy).toHaveBeenCalledWith(context);
      expect(unbind1Spy).toHaveBeenCalledOnce();
      expect(unbind1Spy).toHaveBeenCalledWith(context);
      expect(unbind2Spy).not.toHaveBeenCalled();
      expect(mount1Spy).not.toHaveBeenCalled();
      expect(mount2Spy).toHaveBeenCalledOnce();
      expect(mount2Spy).toHaveBeenCalledWith(part);
      expect(unmount1Spy).not.toHaveBeenCalled();
      expect(unmount2Spy).not.toHaveBeenCalled();
      expect(binding.startNode).toBe(fragment2.startNode);
      expect(binding.endNode).toBe(part.node);
    });

    it('should remount the fragment if it is unmounted', () => {
      const value = new TemplateResult(new MockTemplate(), {});
      const fragment = new MockTemplateFragment(value.data);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TemplateResultBinding(value, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const startNode = document.createComment('');

      const renderSpy = vi
        .spyOn(value.template, 'render')
        .mockReturnValue(fragment);
      const connectSpy = vi.spyOn(fragment, 'connect');
      const bindSpy = vi.spyOn(fragment, 'bind');
      const unbindSpy = vi.spyOn(fragment, 'unbind');
      const mountSpy = vi.spyOn(fragment, 'mount');
      const unmountSpy = vi.spyOn(fragment, 'unmount');
      vi.spyOn(fragment, 'startNode', 'get').mockReturnValue(startNode);

      binding.connect(context);
      updater.flushUpdate(host);

      binding.unbind(context);
      updater.flushUpdate(host);

      binding.bind(value, context);
      updater.flushUpdate(host);

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(value.data, context);
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(value.data, context);
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
      expect(mountSpy).toHaveBeenCalledTimes(2);
      expect(mountSpy).toHaveBeenNthCalledWith(1, part);
      expect(mountSpy).toHaveBeenNthCalledWith(2, part);
      expect(unmountSpy).toHaveBeenCalledOnce();
      expect(unmountSpy).toHaveBeenCalledWith(part);
      expect(binding.startNode).toBe(startNode);
      expect(binding.endNode).toBe(part.node);
    });
  });

  describe('.unbind()', () => {
    it('should unbind data from the current fragment', () => {
      const value = new TemplateResult(new MockTemplate(), {});
      const fragment = new MockTemplateFragment(value.data, [
        document.createComment(''),
      ]);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TemplateResultBinding(value, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      const renderSpy = vi
        .spyOn(value.template, 'render')
        .mockReturnValue(fragment);
      const connectSpy = vi.spyOn(fragment, 'connect');
      const unbindSpy = vi.spyOn(fragment, 'unbind');
      const unmountSpy = vi.spyOn(fragment, 'unmount');

      binding.connect(context);
      updater.flushUpdate(host);

      binding.unbind(context);
      updater.flushUpdate(host);

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(value.data, context);
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
      expect(unmountSpy).toHaveBeenCalledOnce();
      expect(unmountSpy).toHaveBeenCalledWith(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect the current fragment', () => {
      const value = new TemplateResult(new MockTemplate(), {});
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TemplateResultBinding(value, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const fragment = new MockTemplateFragment(value.data);

      const renderSpy = vi
        .spyOn(value.template, 'render')
        .mockReturnValue(fragment);
      const connectSpy = vi.spyOn(fragment, 'connect');
      const disconnectSpy = vi.spyOn(fragment, 'disconnect');

      binding.connect(context);
      updater.flushUpdate(host);
      binding.disconnect();

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(value.data, context);
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).toHaveBeenCalledOnce();
    });
  });
});
