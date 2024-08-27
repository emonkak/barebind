import { describe, expect, it, vi } from 'vitest';

import { PartType, UpdateContext } from '../../src/baseTypes.js';
import { ElementBinding } from '../../src/bindings/element.js';
import { ElementTemplate } from '../../src/templates/elementTemplate.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import {
  MockBlock,
  MockRenderHost,
  TextBinding,
  TextDirective,
} from '../mocks.js';

describe('ElementTemplate', () => {
  describe('.render()', () => {
    it('should return ElementTemplateView initialized with NodeBinding', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const elementValue = { class: 'foo' };
      const childValue = new TextDirective('bar');
      const view = new ElementTemplate('div').render(
        {
          elementValue,
          childValue,
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
      expect(view.childBinding).toBeInstanceOf(TextBinding);
      expect(view.childBinding.value).toBe(childValue);
      expect(view.childBinding.part).toMatchObject({
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
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const data = { elementValue: { class: 'foo' }, childValue: 'bar' };
      const view = new ElementTemplate('div').render(data, context);

      const elmentConnectSpy = vi.spyOn(view.elementBinding, 'connect');
      const childConnectSpy = vi.spyOn(view.elementBinding, 'connect');

      view.connect(context);

      expect(elmentConnectSpy).toHaveBeenCalledOnce();
      expect(elmentConnectSpy).toHaveBeenCalledWith(context);
      expect(childConnectSpy).toHaveBeenCalledOnce();
      expect(childConnectSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.bind()', () => {
    it('should bind new values to the element and child bindings', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const data = { elementValue: { class: 'foo' }, childValue: 'bar' };
      const view = new ElementTemplate('div').render(data, context);

      const elmentBindSpy = vi.spyOn(view.elementBinding, 'bind');
      const childBindSpy = vi.spyOn(view.childBinding, 'bind');

      view.bind(data, context);

      expect(elmentBindSpy).toHaveBeenCalledOnce();
      expect(elmentBindSpy).toHaveBeenCalledWith(data.elementValue, context);
      expect(childBindSpy).toHaveBeenCalledOnce();
      expect(childBindSpy).toHaveBeenCalledWith(data.childValue, context);
    });
  });

  describe('.unbind()', () => {
    it('should unbind values from the element and child bindings', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const data = { elementValue: { class: 'foo' }, childValue: 'bar' };
      const view = new ElementTemplate('div').render(data, context);

      const elmentUnbindSpy = vi.spyOn(view.elementBinding, 'unbind');
      const childUnbindSpy = vi.spyOn(view.childBinding, 'unbind');

      view.unbind(context);

      expect(elmentUnbindSpy).toHaveBeenCalledOnce();
      expect(elmentUnbindSpy).toHaveBeenCalledWith(context);
      expect(childUnbindSpy).toHaveBeenCalledOnce();
      expect(childUnbindSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect the element and child bindings', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const view = new ElementTemplate('div').render(
        { elementValue: { class: 'foo' }, childValue: 'bar' },
        context,
      );

      const elementDisconnectSpy = vi.spyOn(view.elementBinding, 'disconnect');
      const childDisconnectSpy = vi.spyOn(view.childBinding, 'disconnect');

      view.disconnect(context);

      expect(elementDisconnectSpy).toHaveBeenCalledOnce();
      expect(elementDisconnectSpy).toHaveBeenCalledWith(context);
      expect(childDisconnectSpy).toHaveBeenCalledOnce();
      expect(childDisconnectSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.mount()', () => {
    it('should mount the element before the part node', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
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
          childValue: new TextDirective('bar'),
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
