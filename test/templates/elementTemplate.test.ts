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
  describe('.constructor', () => {
    it('should construct a new ElementTemplate', () => {
      const type = 'div';
      const options = { namespace: 'http://www.w3.org/1999/xhtml' };
      const template = new ElementTemplate(type, options);
      expect(template.type).toBe(type);
      expect(template.options).toBe(options);
    });
  });

  describe('.render()', () => {
    it('should render ElementTemplateView', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const elementValue = { class: 'foo' };
      const childValue = new TextDirective('bar');
      const view = new ElementTemplate('div', {
        namespace: 'http://www.w3.org/1999/xhtml',
      }).render([elementValue, childValue], context);

      expect(context.isPending()).toBe(false);
      expect(view.elementBinding).toBeInstanceOf(ElementBinding);
      expect(view.elementBinding.value).toBe(elementValue);
      expect(view.elementBinding.part).toMatchObject({
        type: PartType.Element,
        node: expect.any(Element),
      });
      expect(view.elementBinding.part.node.nodeName).toBe('DIV');
      expect((view.elementBinding.part.node as Element).namespaceURI).toBe(
        'http://www.w3.org/1999/xhtml',
      );
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
});

describe('ElementTemplateView', () => {
  describe('.connect()', () => {
    it('should connect the element and child bindings', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const data = [{ class: 'foo' }, 'bar'] as const;
      const view = new ElementTemplate('div').render(data, context);

      const elmentConnectSpy = vi.spyOn(view.elementBinding, 'connect');
      const childConnectSpy = vi.spyOn(view.childBinding, 'connect');

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

      const data = [{ class: 'foo' }, 'bar'] as const;
      const view = new ElementTemplate('div').render(data, context);

      const elmentBindSpy = vi.spyOn(view.elementBinding, 'bind');
      const childBindSpy = vi.spyOn(view.childBinding, 'bind');

      view.bind(data, context);

      expect(elmentBindSpy).toHaveBeenCalledOnce();
      expect(elmentBindSpy).toHaveBeenCalledWith(data[0], context);
      expect(childBindSpy).toHaveBeenCalledOnce();
      expect(childBindSpy).toHaveBeenCalledWith(data[1], context);
    });
  });

  describe('.unbind()', () => {
    it('should unbind values from the element and child bindings', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const data = [{ class: 'foo' }, 'bar'] as const;
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
        [{ class: 'foo' }, 'bar'],
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
        [{ class: 'foo' }, new TextDirective('bar')],
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
