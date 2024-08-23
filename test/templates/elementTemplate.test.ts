import { describe, expect, it, vi } from 'vitest';

import { PartType, UpdateContext } from '../../src/baseTypes.js';
import { ElementBinding } from '../../src/bindings/element.js';
import { ElementTemplate } from '../../src/templates/elementTemplate.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import {
  MockBlock,
  MockUpdateHost,
  TextBinding,
  TextDirective,
} from '../mocks.js';

describe('ElementTemplate', () => {
  describe('.render()', () => {
    it('should return ElementTemplateView initialized with NodeBinding', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const elementValue = { class: 'foo' };
      const childNodeValue = new TextDirective('bar');
      const view = new ElementTemplate('div').render(
        {
          elementValue,
          childNodeValue,
        },
        context,
      );

      expect(context.isPending()).toBe(false);
      expect(view.elementBinding).toBeInstanceOf(ElementBinding);
      expect(view.elementBinding.value).toBe(elementValue);
      expect(view.elementBinding.part).toMatchObject({
        type: PartType.Element,
        node: expect.any(Element),
      });
      expect(view.elementBinding.part.node.nodeName).toBe('DIV');
      expect(view.childNodeBinding).toBeInstanceOf(TextBinding);
      expect(view.childNodeBinding.value).toBe(childNodeValue);
      expect(view.childNodeBinding.part).toMatchObject({
        type: PartType.ChildNode,
        node: expect.any(Comment),
      });
      expect(view.startNode).toBe(view.elementBinding.startNode);
      expect(view.endNode).toBe(view.elementBinding.endNode);
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

describe('ElementTemplateView', () => {
  describe('.connect()', () => {
    it('should connect the element and child bindings', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const data = { elementValue: { class: 'foo' }, childNodeValue: 'bar' };
      const view = new ElementTemplate('div').render(data, context);

      const elmentConnectSpy = vi.spyOn(view.elementBinding, 'connect');
      const childNodeConnectSpy = vi.spyOn(view.elementBinding, 'connect');

      view.connect(context);

      expect(elmentConnectSpy).toHaveBeenCalledOnce();
      expect(elmentConnectSpy).toHaveBeenCalledWith(context);
      expect(childNodeConnectSpy).toHaveBeenCalledOnce();
      expect(childNodeConnectSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.bind()', () => {
    it('should bind new values to the element and child bindings', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const data = { elementValue: { class: 'foo' }, childNodeValue: 'bar' };
      const view = new ElementTemplate('div').render(data, context);

      const elmentBindSpy = vi.spyOn(view.elementBinding, 'bind');
      const childNodeBindSpy = vi.spyOn(view.childNodeBinding, 'bind');

      view.bind(data, context);

      expect(elmentBindSpy).toHaveBeenCalledOnce();
      expect(elmentBindSpy).toHaveBeenCalledWith(data.elementValue, context);
      expect(childNodeBindSpy).toHaveBeenCalledOnce();
      expect(childNodeBindSpy).toHaveBeenCalledWith(
        data.childNodeValue,
        context,
      );
    });
  });

  describe('.unbind()', () => {
    it('should unbind values from the element and child bindings', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const data = { elementValue: { class: 'foo' }, childNodeValue: 'bar' };
      const view = new ElementTemplate('div').render(data, context);

      const elmentUnbindSpy = vi.spyOn(view.elementBinding, 'unbind');
      const childNodeUnbindSpy = vi.spyOn(view.childNodeBinding, 'unbind');

      view.unbind(context);

      expect(elmentUnbindSpy).toHaveBeenCalledOnce();
      expect(elmentUnbindSpy).toHaveBeenCalledWith(context);
      expect(childNodeUnbindSpy).toHaveBeenCalledOnce();
      expect(childNodeUnbindSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect the element and child bindings', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const view = new ElementTemplate('div').render(
        { elementValue: { class: 'foo' }, childNodeValue: 'bar' },
        context,
      );

      const elementDisconnectSpy = vi.spyOn(view.elementBinding, 'disconnect');
      const childNodeDisconnectSpy = vi.spyOn(
        view.childNodeBinding,
        'disconnect',
      );

      view.disconnect(context);

      expect(elementDisconnectSpy).toHaveBeenCalledOnce();
      expect(elementDisconnectSpy).toHaveBeenCalledWith(context);
      expect(childNodeDisconnectSpy).toHaveBeenCalledOnce();
      expect(childNodeDisconnectSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.mount()', () => {
    it('should mount the element before the part node', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const view = new ElementTemplate('div').render(
        {
          elementValue: { class: 'foo' },
          childNodeValue: new TextDirective('bar'),
        },
        context,
      );

      container.appendChild(part.node);
      view.connect(context);
      context.flushUpdate();

      expect(container.innerHTML).toBe('<!---->');

      view.mount(part);

      expect(container.innerHTML).toBe(
        '<div class="foo">bar<!--TextDirective--></div><!---->',
      );

      view.unmount(part);

      expect(container.innerHTML).toBe('<!---->');
    });
  });
});
