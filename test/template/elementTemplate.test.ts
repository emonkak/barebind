import { describe, expect, it, vi } from 'vitest';

import { ElementBinding } from '../../src/binding.js';
import {
  ElementTemplate,
  ElementTemplateFragment,
} from '../../src/template/elementTemplate.js';
import { PartType, createUpdateContext } from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockUpdateHost, TextBinding, TextDirective } from '../mocks.js';

describe('ElementTemplate', () => {
  describe('.render()', () => {
    it('should return SingleTemplateFragment initialized with NodeBinding', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const elementValue = { class: 'foo' };
      const childNodeValue = new TextDirective('bar');
      const fragment = new ElementTemplate('div').render(
        {
          elementValue,
          childNodeValue,
        },
        context,
      );

      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
      expect(fragment.elementBinding).toBeInstanceOf(ElementBinding);
      expect(fragment.elementBinding.value).toBe(elementValue);
      expect(fragment.elementBinding.part).toMatchObject({
        type: PartType.Element,
        node: expect.any(Element),
      });
      expect(fragment.elementBinding.part.node.nodeName).toBe('DIV');
      expect(fragment.childNodeBinding).toBeInstanceOf(TextBinding);
      expect(fragment.childNodeBinding.value).toBe(childNodeValue);
      expect(fragment.childNodeBinding.part).toMatchObject({
        type: PartType.ChildNode,
        node: expect.any(Comment),
      });
      expect(fragment.startNode).toBe(fragment.elementBinding.startNode);
      expect(fragment.endNode).toBe(fragment.elementBinding.endNode);
    });
  });

  describe('.isSameTemplate()', () => {
    it('should return true if an instance is the same', () => {
      const template = new ElementTemplate('div');
      expect(template.isSameTemplate(template)).toBe(true);
    });

    it('should return true if a type is the same', () => {
      expect(
        new ElementTemplate('div').isSameTemplate(new ElementTemplate('div')),
      ).toBe(true);
    });

    it('should return false if a type is not the same', () => {
      expect(
        new ElementTemplate('div').isSameTemplate(new ElementTemplate('p')),
      ).toBe(false);
    });
  });
});

describe('ElementTemplateFragment', () => {
  describe('.connect()', () => {
    it('should bind values to element and child binding', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const fragment = new ElementTemplateFragment(
        'div',
        { elementValue: { class: 'foo' }, childNodeValue: 'bar' },
        context,
      );

      fragment.connect(context);
      updater.flushUpdate(host);

      expect((fragment.elementBinding.part.node as Element).outerHTML).toBe(
        '<div class="foo"><!--bar--></div>',
      );

      fragment.bind(
        { elementValue: { class: 'bar' }, childNodeValue: 'baz' },
        context,
      );
      updater.flushUpdate(host);

      expect((fragment.elementBinding.part.node as Element).outerHTML).toBe(
        '<div class="bar"><!--baz--></div>',
      );

      fragment.unbind(context);
      updater.flushUpdate(host);

      expect((fragment.elementBinding.part.node as Element).outerHTML).toBe(
        '<div><!----></div>',
      );
    });
  });

  describe('.mount()', () => {
    it('should mount the element before the part node', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const fragment = new ElementTemplateFragment(
        'div',
        {
          elementValue: { class: 'foo' },
          childNodeValue: new TextDirective('bar'),
        },
        context,
      );
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;

      container.appendChild(part.node);
      fragment.connect(context);
      updater.flushUpdate(host);

      fragment.mount(part);

      expect(container.innerHTML).toBe(
        '<div class="foo">bar<!--TextDirective--></div><!---->',
      );

      fragment.unmount(part);

      expect(container.innerHTML).toBe('<!---->');
    });
  });

  describe('.unmount()', () => {
    it('should not remove the node if a different part is given', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const fragment = new ElementTemplateFragment(
        'div',
        {
          elementValue: { class: 'foo' },
          childNodeValue: new TextDirective('bar'),
        },
        context,
      );
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;

      container.appendChild(part.node);
      fragment.connect(context);
      updater.flushUpdate(host);

      fragment.mount(part);

      expect(container.innerHTML).toBe(
        '<div class="foo">bar<!--TextDirective--></div><!---->',
      );

      fragment.unmount({
        type: PartType.ChildNode,
        node: document.createComment(''),
      });

      expect(container.innerHTML).toBe(
        '<div class="foo">bar<!--TextDirective--></div><!---->',
      );
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect from the binding', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const fragment = new ElementTemplateFragment(
        'div',
        { elementValue: { class: 'foo' }, childNodeValue: 'bar' },
        context,
      );

      const elementBindingDisconnectSpy = vi.spyOn(
        fragment.elementBinding,
        'disconnect',
      );
      const childNodeBindingDisconnectSpy = vi.spyOn(
        fragment.childNodeBinding,
        'disconnect',
      );

      fragment.disconnect();

      expect(elementBindingDisconnectSpy).toHaveBeenCalledOnce();
      expect(childNodeBindingDisconnectSpy).toHaveBeenCalledOnce();
    });
  });
});
