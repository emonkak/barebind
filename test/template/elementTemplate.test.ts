import { describe, expect, it, vi } from 'vitest';

import { ElementBinding, NodeBinding } from '../../src/binding.js';
import {
  ElementTemplate,
  ElementTemplateFragment,
} from '../../src/template/elementTemplate.js';
import { PartType } from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockBinding, MockDirective, MockRenderingEngine } from '../mocks.js';

describe('ElementTemplate', () => {
  describe('.hydrate()', () => {
    it('should hydrate SingleTemplateFragment initialized with NodeBinding', () => {
      const updater = new SyncUpdater(new MockRenderingEngine());
      const fragment = new ElementTemplate('div').hydrate(
        {
          elementValue: { class: 'foo' },
          childNodeValue: 'bar',
        },
        updater,
      );

      updater.flush();

      expect(fragment.elementBinding).toBeInstanceOf(ElementBinding);
      expect(fragment.elementBinding.value).toEqual({ class: 'foo' });
      expect(fragment.elementBinding.part).toMatchObject({
        type: PartType.Element,
        node: expect.any(Element),
      });
      expect((fragment.elementBinding.part.node as Element).outerHTML).toBe(
        '<div class="foo"></div>',
      );
      expect(fragment.elementBinding.part.node.nodeName).toBe('DIV');
      expect(fragment.childNodeBinding).toBeInstanceOf(NodeBinding);
      expect(fragment.childNodeBinding.value).toBe('bar');
      expect(fragment.childNodeBinding.part).toMatchObject({
        type: PartType.ChildNode,
        node: expect.any(Comment),
      });
      expect(fragment.childNodeBinding.part.node.nodeValue).toBe('bar');
    });

    it('should hydrate SingleTemplateFragment by a directive', () => {
      const updater = new SyncUpdater(new MockRenderingEngine());
      const elementDirective = new MockDirective();
      const childNodeDirective = new MockDirective();
      const fragment = new ElementTemplate('div').hydrate(
        {
          elementValue: elementDirective,
          childNodeValue: childNodeDirective,
        },
        updater,
      );

      expect(fragment.elementBinding).toBeInstanceOf(MockBinding);
      expect(fragment.elementBinding.value).toBe(elementDirective);
      expect(fragment.elementBinding.part).toMatchObject({
        type: PartType.Element,
        node: expect.any(Element),
      });
      expect(fragment.elementBinding.part.node.nodeName).toBe('DIV');
      expect(fragment.childNodeBinding).toBeInstanceOf(MockBinding);
      expect(fragment.childNodeBinding.value).toBe(childNodeDirective);
      expect(fragment.childNodeBinding.part).toMatchObject({
        type: PartType.ChildNode,
        node: expect.any(Comment),
      });
    });
  });

  describe('.isSameTemplate()', () => {
    it('should return true if the instance is the same', () => {
      const template = new ElementTemplate('div');
      expect(template.isSameTemplate(template)).toBe(true);
    });

    it('should return true if the type is the same', () => {
      expect(
        new ElementTemplate('div').isSameTemplate(new ElementTemplate('div')),
      ).toBe(true);
    });
  });
});

describe('ElementTemplateFragment', () => {
  describe('.constructor()', () => {
    it('should construct a new SingleTemplateFragment', () => {
      const elementBinding = new ElementBinding(
        { class: 'foo' },
        {
          type: PartType.Element,
          node: document.createElement('div'),
        },
      );
      const childNodeBinding = new NodeBinding('bar', {
        type: PartType.Node,
        node: document.createTextNode(''),
      });
      const fragment = new ElementTemplateFragment(
        elementBinding,
        childNodeBinding,
      );

      expect(fragment.elementBinding).toBe(elementBinding);
      expect(fragment.childNodeBinding).toBe(childNodeBinding);
      expect(fragment.startNode).toBe(elementBinding.startNode);
      expect(fragment.endNode).toBe(elementBinding.endNode);
    });
  });

  describe('.attach()', () => {
    it('should bind a value to the bindings', () => {
      const elementBinding = new ElementBinding(
        { class: 'foo' },
        {
          type: PartType.Element,
          node: document.createElement('div'),
        },
      );
      const childNodeBinding = new NodeBinding('bar', {
        type: PartType.Node,
        node: document.createTextNode(''),
      });
      const fragment = new ElementTemplateFragment(
        elementBinding,
        childNodeBinding,
      );
      const updater = new SyncUpdater(new MockRenderingEngine());
      const elementBindingBindSpy = vi.spyOn(elementBinding, 'bind');
      const childNodeBindingBindSpy = vi.spyOn(childNodeBinding, 'bind');

      fragment.attach(
        { elementValue: { class: 'bar' }, childNodeValue: 'baz' },
        updater,
      );

      expect(elementBindingBindSpy).toHaveBeenCalledOnce();
      expect(elementBindingBindSpy).toHaveBeenCalledWith(
        { class: 'bar' },
        updater,
      );
      expect(childNodeBindingBindSpy).toHaveBeenCalledOnce();
      expect(childNodeBindingBindSpy).toHaveBeenCalledWith('baz', updater);
    });
  });

  describe('.detach()', () => {
    it('should unbind the value from the bindings', () => {
      const elementBinding = new ElementBinding(
        { class: 'foo' },
        {
          type: PartType.Element,
          node: document.createElement('div'),
        },
      );
      const childNodeBinding = new NodeBinding('bar', {
        type: PartType.Node,
        node: document.createTextNode(''),
      });
      const fragment = new ElementTemplateFragment(
        elementBinding,
        childNodeBinding,
      );
      const updater = new SyncUpdater(new MockRenderingEngine());
      const elementBindingUnbindSpy = vi.spyOn(elementBinding, 'unbind');
      const childNodeBindingUnbindSpy = vi.spyOn(childNodeBinding, 'unbind');

      fragment.detach(updater);

      expect(elementBindingUnbindSpy).toHaveBeenCalledOnce();
      expect(childNodeBindingUnbindSpy).toHaveBeenCalledOnce();
    });
  });

  describe('.mount()', () => {
    it('should mount the binding before the part', () => {
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const elementBinding = new ElementBinding(
        { class: 'foo' },
        {
          type: PartType.Element,
          node: document.createElement('div'),
        },
      );
      const childNodeBinding = new NodeBinding('bar', {
        type: PartType.Node,
        node: document.createTextNode('bar'),
      });
      const fragment = new ElementTemplateFragment(
        elementBinding,
        childNodeBinding,
      );
      const updater = new SyncUpdater(new MockRenderingEngine());

      elementBinding.connect(updater);
      childNodeBinding.connect(updater);
      updater.flush();

      container.appendChild(part.node);
      fragment.mount(part);

      expect(container.innerHTML).toBe('<div class="foo">bar</div><!---->');

      fragment.unmount(part);

      expect(container.innerHTML).toBe('<!---->');
    });
  });

  describe('.unmount()', () => {
    it('should do nothing if a different part from the one at mount is given', () => {
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const elementBinding = new ElementBinding(
        { class: 'foo' },
        {
          type: PartType.Element,
          node: document.createElement('div'),
        },
      );
      const childNodeBinding = new NodeBinding('bar', {
        type: PartType.Node,
        node: document.createTextNode('bar'),
      });
      const fragment = new ElementTemplateFragment(
        elementBinding,
        childNodeBinding,
      );
      const updater = new SyncUpdater(new MockRenderingEngine());

      elementBinding.connect(updater);
      childNodeBinding.connect(updater);
      updater.flush();

      container.appendChild(part.node);
      fragment.mount(part);

      expect(container.innerHTML).toBe('<div class="foo">bar</div><!---->');

      fragment.unmount({
        type: PartType.ChildNode,
        node: document.createComment(''),
      });

      expect(container.innerHTML).toBe('<div class="foo">bar</div><!---->');
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect from the binding', () => {
      const elementBinding = new ElementBinding(
        { class: 'foo' },
        {
          type: PartType.Element,
          node: document.createElement('div'),
        },
      );
      const childNodeBinding = new NodeBinding('bar', {
        type: PartType.Node,
        node: document.createTextNode(''),
      });
      const fragment = new ElementTemplateFragment(
        elementBinding,
        childNodeBinding,
      );
      const elementBindingDisconnectSpy = vi.spyOn(
        elementBinding,
        'disconnect',
      );
      const childNodeBindingDisconnectSpy = vi.spyOn(
        childNodeBinding,
        'disconnect',
      );

      fragment.disconnect();

      expect(elementBindingDisconnectSpy).toHaveBeenCalledOnce();
      expect(childNodeBindingDisconnectSpy).toHaveBeenCalledOnce();
    });
  });
});
