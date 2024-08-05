import { describe, expect, it, vi } from 'vitest';

import { PartType, UpdateContext, directiveTag } from '../src/baseTypes.js';
import {
  AttributeBinding,
  ElementBinding,
  EventBinding,
  NodeBinding,
  PropertyBinding,
  resolveBinding,
} from '../src/binding.js';
import { SyncUpdater } from '../src/updater/syncUpdater.js';
import {
  MockBlock,
  MockUpdateHost,
  TextBinding,
  TextDirective,
} from './mocks.js';

describe('AttributeBinding', () => {
  describe('.constructor()', () => {
    it('should construct a new AttributeBinding', () => {
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      } as const;

      const value = 'foo';
      const binding = new AttributeBinding(value, part);

      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.value).toBe(value);
    });
  });

  describe('.bind()', () => {
    it('should update the attribute with the passed string', () => {
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = 'foo';
      const binding = new AttributeBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      expect(binding.value).toBe(value);
      expect(part.node.getAttribute('class')).toBe(value);

      binding.bind(value, context);
      context.flushUpdate();

      expect(binding.value).toBe(value);
      expect(part.node.getAttribute('class')).toBe(value);
    });

    it('should update the attribute with the string representation of the object', () => {
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value1 = {
        toString() {
          return 'foo';
        },
      };
      const value2 = {
        toString() {
          return 'bar';
        },
      };
      const binding = new AttributeBinding(value1, part);

      binding.connect(context);
      context.flushUpdate();

      expect(binding.value).toBe(value1);
      expect(part.node.getAttribute('class')).toBe('foo');

      binding.bind(value2, context);
      context.flushUpdate();

      expect(binding.value).toBe(value2);
      expect(part.node.getAttribute('class')).toBe('bar');
    });

    it('should toggle the attribute according to the boolean value', () => {
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'contenteditable',
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const binding = new AttributeBinding(true, part);

      binding.connect(context);
      context.flushUpdate();

      expect(binding.value).toBe(true);
      expect(part.node.hasAttribute('contenteditable')).toBe(true);

      binding.bind(false, context);
      context.flushUpdate();

      expect(binding.value).toBe(false);
      expect(part.node.hasAttribute('contenteditable')).toBe(false);
    });

    it.each([[null], [undefined]])(
      'should remove the attribute when null or undefined is passed',
      (value) => {
        const part = {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: 'contenteditable',
        } as const;
        const host = new MockUpdateHost();
        const updater = new SyncUpdater();
        const context = new UpdateContext(host, updater, new MockBlock());

        const binding = new AttributeBinding(value, part);

        part.node.toggleAttribute('contenteditable', true);
        binding.connect(context);
        context.flushUpdate();

        expect(binding.value).toBe(value);
        expect(part.node.hasAttribute('contenteditable')).toBe(false);
      },
    );

    it('should remove the attribute when undefined is passed', () => {
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'contenteditable',
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const binding = new AttributeBinding(undefined, part);

      part.node.toggleAttribute('contenteditable', true);
      binding.connect(context);
      context.flushUpdate();

      expect(binding.value).toBe(undefined);
      expect(part.node.hasAttribute('contenteditable')).toBe(false);
    });

    it('should not update the binding if the new and old values are the same', () => {
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = 'foo';
      const binding = new AttributeBinding('foo', part);

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value, context);

      expect(binding.value).toBe(value);
      expect(context.isPending()).toBe(false);
    });

    it('should do nothing if the update is already scheduled', () => {
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'contenteditable',
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const binding = new AttributeBinding(undefined, part);

      const enqueueMutationEffectSpy = vi.spyOn(
        context,
        'enqueueMutationEffect',
      );

      binding.connect(context);
      binding.connect(context);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });

    it('should throw the error if the value is a directive', () => {
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const binding = new AttributeBinding(null, part);

      expect(() => {
        binding.bind(new TextDirective(), context);
      }).toThrow('A value must not be a directive,');
    });
  });

  describe('.unbind()', () => {
    it('should remove the attribute', () => {
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'contenteditable',
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const binding = new AttributeBinding(true, part);

      binding.connect(context);
      context.flushUpdate();

      binding.unbind(context);
      context.flushUpdate();

      expect(binding.value).toBe(true);
      expect(part.node.hasAttribute('contenteditable')).toBe(false);
    });

    it.each([[null], [undefined]])(
      'should do nothing if the value is null or undefined',
      (value) => {
        const part = {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: 'contenteditable',
        } as const;
        const host = new MockUpdateHost();
        const updater = new SyncUpdater();
        const context = new UpdateContext(host, updater, new MockBlock());

        const binding = new AttributeBinding(value, part);

        binding.unbind(context);

        expect(binding.value).toBe(value);
        expect(context.isPending()).toBe(false);
      },
    );
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'contenteditable',
      } as const;
      const binding = new AttributeBinding(true, part);

      binding.disconnect();
    });
  });
});

describe('EventBinding', () => {
  describe('.constructor()', () => {
    it('should construct a new EventBinding', () => {
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'hello',
      } as const;

      const value = () => {};
      const binding = new EventBinding(value, part);

      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.value).toBe(value);
    });

    it('should throw the error if the value other than an event listner is passed', () => {
      expect(() => {
        new EventBinding(
          {},
          {
            type: PartType.Event,
            node: document.createElement('div'),
            name: 'hello',
          },
        );
      }).toThrow(
        'A value of EventBinding must be EventListener, EventListenerObject, null or undefined.',
      );
    });
  });

  describe('.connect()', () => {
    it('should do nothing if the update is already scheduled', () => {
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'click',
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = () => {};
      const binding = new EventBinding(value, part);

      const enqueueMutationEffectSpy = vi.spyOn(
        context,
        'enqueueMutationEffect',
      );

      binding.connect(context);
      binding.connect(context);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });
  });

  describe('.bind()', () => {
    it('should connect the function to the element as an event listener', () => {
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'hello',
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const event = new CustomEvent('hello');
      const value1 = vi.fn();
      const value2 = vi.fn();
      const binding = new EventBinding(value1, part);

      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');

      binding.connect(context);
      context.flushUpdate();
      part.node.dispatchEvent(event);

      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith('hello', binding);
      expect(value1).toHaveBeenCalledOnce();
      expect(value1).toHaveBeenCalledWith(event);
      expect(value2).not.toHaveBeenCalled();

      binding.bind(value2, context);
      context.flushUpdate();
      part.node.dispatchEvent(event);

      expect(value1).toHaveBeenCalledOnce();
      expect(value2).toHaveBeenCalledWith(event);
    });

    it('should connect the object to the element as an event listener', () => {
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'hello',
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const event = new CustomEvent('hello');
      const value1 = {
        capture: true,
        handleEvent: vi.fn(),
      };
      const value2 = {
        capture: false,
        handleEvent: vi.fn(),
      };
      const binding = new EventBinding(value1, part);

      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      binding.connect(context);
      context.flushUpdate();
      part.node.dispatchEvent(event);

      expect(addEventListenerSpy).toHaveBeenCalledTimes(1);
      expect(addEventListenerSpy).toHaveBeenLastCalledWith(
        'hello',
        binding,
        value1,
      );
      expect(value1.handleEvent).toHaveBeenCalledOnce();
      expect(value1.handleEvent).toHaveBeenCalledWith(event);
      expect(value2.handleEvent).not.toHaveBeenCalled();

      binding.bind(value2, context);
      context.flushUpdate();
      part.node.dispatchEvent(event);

      expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
      expect(addEventListenerSpy).toHaveBeenLastCalledWith(
        'hello',
        binding,
        value2,
      );
      expect(removeEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'hello',
        binding,
        value1,
      );
      expect(value2.handleEvent).toHaveBeenCalledOnce();
      expect(value2.handleEvent).toHaveBeenCalledWith(event);
    });

    it('should not connect the event listener if the new and current listeners are the same', () => {
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'hello',
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = () => {};
      const binding = new EventBinding(value, part);

      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      binding.connect(context);
      context.flushUpdate();

      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).not.toHaveBeenCalled();

      binding.bind(value, context);

      expect(context.isPending()).toBe(false);
    });

    it.each([[null], [undefined]])(
      'should unbind the active event listener when null or undefined is passed',
      (value2) => {
        const part = {
          type: PartType.Event,
          node: document.createElement('div'),
          name: 'hello',
        } as const;
        const host = new MockUpdateHost();
        const updater = new SyncUpdater();
        const context = new UpdateContext(host, updater, new MockBlock());

        const event = new CustomEvent('hello');
        const value1 = vi.fn();
        const binding = new EventBinding(value1, part);

        const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
        const removeEventListenerSpy = vi.spyOn(
          part.node,
          'removeEventListener',
        );

        binding.connect(context);
        context.flushUpdate();
        part.node.dispatchEvent(event);

        binding.bind(value2, context);
        context.flushUpdate();
        part.node.dispatchEvent(event);

        expect(addEventListenerSpy).toHaveBeenCalledOnce();
        expect(addEventListenerSpy).toHaveBeenCalledWith('hello', binding);
        expect(removeEventListenerSpy).toHaveBeenCalledOnce();
        expect(removeEventListenerSpy).toHaveBeenCalledWith('hello', binding);
        expect(value1).toHaveBeenCalledOnce();
        expect(value1).toHaveBeenCalledWith(event);
      },
    );

    it('should throw the error if the value other than an event listner is assigned', () => {
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'hello',
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const binding = new EventBinding(null, part);

      expect(() => {
        binding.bind({}, context);
      }).toThrow(
        'A value of EventBinding must be EventListener, EventListenerObject, null or undefined.',
      );
    });
  });

  describe('.unbind()', () => {
    it('should unbind the active event listener', () => {
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'hello',
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const event = new CustomEvent('hello');
      const value = vi.fn();
      const binding = new EventBinding(value, part);

      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      binding.connect(context);
      context.flushUpdate();
      part.node.dispatchEvent(event);

      binding.unbind(context);
      context.flushUpdate();
      part.node.dispatchEvent(event);

      expect(binding.value).toBe(value);
      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith('hello', binding);
      expect(removeEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('hello', binding);
      expect(value).toHaveBeenCalledOnce();
      expect(value).toHaveBeenCalledWith(event);
    });

    it('should do nothing if the update is already scheduled', () => {
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'click',
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = () => {};
      const binding = new EventBinding(value, part);

      binding.connect(context);

      context.flushUpdate();

      const enqueueMutationEffectSpy = vi.spyOn(
        context,
        'enqueueMutationEffect',
      );

      binding.unbind(context);
      binding.unbind(context);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });

    it('should do nothing if there is no active listner', () => {
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'click',
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = () => {};
      const binding = new EventBinding(value, part);

      const enqueueMutationEffectSpy = vi.spyOn(
        context,
        'enqueueMutationEffect',
      );

      binding.unbind(context);
      binding.unbind(context);

      expect(enqueueMutationEffectSpy).not.toHaveBeenCalled();
    });
  });

  describe('.disconnect()', () => {
    it('should unregister the active event listener function', () => {
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'hello',
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = () => {};
      const binding = new EventBinding(value, part);

      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      binding.connect(context);
      context.flushUpdate();

      binding.disconnect();

      expect(binding.value).toBe(value);
      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith('hello', binding);
      expect(removeEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('hello', binding);
    });

    it('should unregister the active event listener object', () => {
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'hello',
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = { handleEvent: () => {}, capture: true };
      const binding = new EventBinding(value, part);

      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      binding.connect(context);
      context.flushUpdate();

      binding.disconnect();

      expect(binding.value).toBe(value);
      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith('hello', binding, value);
      expect(removeEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'hello',
        binding,
        value,
      );
    });

    it('should do nothing if no event listener is registered', () => {
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'hello',
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const binding = new EventBinding(null, part);

      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      binding.connect(context);
      context.flushUpdate();

      binding.disconnect();

      expect(addEventListenerSpy).not.toHaveBeenCalled();
      expect(removeEventListenerSpy).not.toHaveBeenCalled();
    });
  });
});

describe('NodeBinding', () => {
  describe('.constructor()', () => {
    it('should construct a new NodeBinding', () => {
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;

      const value = 'foo';
      const binding = new NodeBinding(value, part);

      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.value).toBe(value);
    });
  });

  describe('.bind()', () => {
    it('should update the node value', () => {
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value1 = 'foo';
      const value2 = 'bar';
      const binding = new NodeBinding(value1, part);

      binding.connect(context);
      context.flushUpdate();

      expect(binding.value).toBe(value1);
      expect(part.node.nodeValue).toBe(value1);

      binding.bind(value2, context);
      context.flushUpdate();

      expect(binding.value).toBe(value2);
      expect(part.node.nodeValue).toBe(value2);

      binding.bind(null, context);
      context.flushUpdate();
      context.flushUpdate();

      expect(binding.value).toBe(null);
      expect(part.node.nodeValue).toBe('');
    });

    it('should not update the binding if the new and old values are the same', () => {
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = 'foo';
      const binding = new NodeBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value, context);

      expect(binding.value).toBe(value);
      expect(context.isPending()).toBe(false);
    });

    it('should do nothing if the update is already scheduled', () => {
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const binding = new NodeBinding('foo', part);

      const enqueueMutationEffectSpy = vi.spyOn(
        context,
        'enqueueMutationEffect',
      );

      binding.connect(context);
      binding.connect(context);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });

    it('should throw the error if the value is a directive', () => {
      const part = {
        type: PartType.Node,
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const binding = new NodeBinding('foo', part);

      expect(() => {
        binding.bind(new TextDirective(), context);
      }).toThrow('A value must not be a directive,');
    });
  });

  describe('.unbind()', () => {
    it('should set null to the value of the node', () => {
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = 'foo';
      const binding = new NodeBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      expect(binding.value).toBe(value);
      expect(part.node.nodeValue).toBe(value);

      binding.unbind(context);
      context.flushUpdate();

      expect(binding.value).toBe(value);
      expect(part.node.nodeValue).toBe('');
    });

    it('should do nothing if the value is null', () => {
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const binding = new NodeBinding(null, part);

      binding.unbind(context);

      expect(context.isPending()).toBe(false);
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;

      const binding = new NodeBinding('foo', part);

      binding.disconnect();
    });
  });
});

describe('PropertyBinding', () => {
  describe('.constructor()', () => {
    it('should construct a new PropertyBinding', () => {
      const part = {
        type: PartType.Property,
        node: document.createElement('div'),
        name: 'className',
      } as const;

      const binding = new PropertyBinding('foo', part);

      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.value).toBe('foo');
    });
  });

  describe('.bind()', () => {
    it('should update the property of the element', () => {
      const part = {
        type: PartType.Property,
        node: document.createElement('div'),
        name: 'className',
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value1 = 'foo';
      const value2 = 'bar';
      const binding = new PropertyBinding(value1, part);

      binding.connect(context);
      context.flushUpdate();

      expect(binding.value).toBe(value1);
      expect(part.node.className).toBe(value1);

      binding.bind(value2, context);
      context.flushUpdate();

      expect(binding.value).toBe(value2);
      expect(part.node.className).toBe(value2);
    });

    it('should not update the binding if the new and old values are the same', () => {
      const part = {
        type: PartType.Property,
        node: document.createElement('div'),
        name: 'className',
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = 'bar';
      const binding = new PropertyBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value, context);

      expect(binding.value).toBe(value);
      expect(context.isPending()).toBe(false);
    });

    it('should do nothing if the update is already scheduled', () => {
      const part = {
        type: PartType.Property,
        node: document.createElement('div'),
        name: 'className',
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = 'foo';
      const binding = new PropertyBinding(value, part);

      const enqueueMutationEffectSpy = vi.spyOn(
        context,
        'enqueueMutationEffect',
      );

      binding.connect(context);
      binding.connect(context);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });

    it('should throw the error if the value is a directive', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const binding = new PropertyBinding('foo', {
        type: PartType.Property,
        node: document.createElement('div'),
        name: 'className',
      });

      expect(() => {
        binding.bind(new TextDirective(), context);
      }).toThrow('A value must not be a directive,');
    });
  });

  describe('.unbind()', () => {
    it('should do nothing', () => {
      const part = {
        type: PartType.Property,
        node: document.createElement('div'),
        name: 'className',
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = 'foo';
      const binding = new PropertyBinding(value, part);

      const setClassNameSpy = vi.spyOn(part.node, 'className', 'set');

      binding.unbind(context);
      context.flushUpdate();

      expect(setClassNameSpy).not.toHaveBeenCalled();
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const part = {
        type: PartType.Property,
        node: document.createElement('div'),
        name: 'className',
      } as const;

      const value = 'foo';
      const binding = new PropertyBinding(value, part);

      const setClassNameSpy = vi.spyOn(part.node, 'className', 'set');

      binding.disconnect();

      expect(setClassNameSpy).not.toHaveBeenCalled();
    });
  });
});

describe('ElementBinding', () => {
  describe('.constructor()', () => {
    it('should construct a new ElementBinding', () => {
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;

      const value = {};
      const binding = new ElementBinding(value, part);

      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.value).toBe(value);
    });

    it('should throw the error when a non-object value is passed', () => {
      expect(() => {
        new ElementBinding(null, {
          type: PartType.Element,
          node: document.createElement('div'),
        });
      }).toThrow('A value of ElementBinding must be an object,');
    });
  });

  describe('.value', () => {
    it('should throw the error when a non-object value is passed', () => {
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = {};
      const binding = new ElementBinding(value, part);

      expect(() => {
        binding.bind(null, context);
      }).toThrow('A value of ElementBinding must be an object,');
    });
  });

  describe('.connect()', () => {
    it('should bind element attributes', () => {
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = {
        class: 'foo',
        title: 'bar',
      };
      const binding = new ElementBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      expect(part.node.getAttribute('class')).toBe('foo');
      expect(part.node.getAttribute('title')).toBe('bar');
    });

    it('should bind element properities by properities starting with "."', () => {
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = {
        '.className': 'foo',
        '.title': 'bar',
      };
      const binding = new ElementBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      expect(part.node.className).toBe('foo');
      expect(part.node.title).toBe('bar');
    });

    it('should bind event listeners by properities starting with "@"', () => {
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = {
        '@click': () => {},
        '@touchstart': () => {},
      };
      const binding = new ElementBinding(value, part);

      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');

      binding.connect(context);
      context.flushUpdate();

      expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'click',
        expect.any(EventBinding),
      );
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'touchstart',
        expect.any(EventBinding),
      );
    });

    it('should not update any binding if the new and old properities are the same', () => {
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = {
        class: 'foo',
        title: 'bar',
      };
      const binding = new ElementBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value, context);
      context.flushUpdate();

      expect(context.isPending()).toBe(false);
    });

    it('should skip properties that are passed the same value as last time', () => {
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = {
        class: 'foo',
        title: 'bar',
      };
      const binding = new ElementBinding(value, part);

      const setAttributeSpy = vi.spyOn(part.node, 'setAttribute');

      binding.connect(context);
      context.flushUpdate();

      binding.bind(
        {
          class: 'foo', // same value as last time
          title: 'baz',
        },
        context,
      );
      context.flushUpdate();

      expect(setAttributeSpy).toHaveBeenCalledTimes(3);
      expect(setAttributeSpy).toHaveBeenNthCalledWith(1, 'class', 'foo');
      expect(setAttributeSpy).toHaveBeenNthCalledWith(2, 'title', 'bar');
      expect(setAttributeSpy).toHaveBeenNthCalledWith(3, 'title', 'baz');
      expect(part.node.getAttribute('class')).toBe('foo');
      expect(part.node.getAttribute('title')).toBe('baz');
    });

    it('should unbind bindings that no longer exists', () => {
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = {
        class: 'foo',
        title: 'bar',
      };
      const binding = new ElementBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      binding.bind({ class: undefined }, context);
      context.flushUpdate();

      expect(part.node.hasAttribute('class')).toBe(false);
      expect(part.node.hasAttribute('title')).toBe(false);
    });
  });

  describe('.unbind()', () => {
    it('should unbind all bound properities', () => {
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = {
        class: 'foo',
        title: 'bar',
      };
      const binding = new ElementBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      binding.unbind(context);
      context.flushUpdate();

      expect(part.node.hasAttribute('class')).toBe(false);
      expect(part.node.hasAttribute('title')).toBe(false);
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect all bound properities', () => {
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = {
        foo: new TextDirective(),
        bar: new TextDirective(),
      };
      const binding = new ElementBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      const disconnect1Spy = vi.spyOn(
        binding.bindings.get('foo')!,
        'disconnect',
      );
      const disconnect2Spy = vi.spyOn(
        binding.bindings.get('bar')!,
        'disconnect',
      );

      binding.disconnect();

      expect(disconnect1Spy).toHaveBeenCalledOnce();
      expect(disconnect2Spy).toHaveBeenCalledOnce();
    });
  });
});

describe('resolveBinding()', () => {
  it('should perform the value if it is a directive', () => {
    const part = {
      type: PartType.Node,
      node: document.createTextNode(''),
    } as const;
    const host = new MockUpdateHost();
    const updater = new SyncUpdater();
    const context = new UpdateContext(host, updater, new MockBlock());

    const value = new TextDirective();
    const directiveSpy = vi.spyOn(value, directiveTag);
    const binding = resolveBinding(value, part, context);

    expect(binding).toBeInstanceOf(TextBinding);
    expect(binding.value).toBe(value);
    expect(binding.part).toBe(part);
    expect(directiveSpy).toHaveBeenCalledOnce();
    expect(directiveSpy).toHaveBeenCalledWith(part, context);
  });

  it('should resolve the value as a AttributeBinding if the part is a AttributePart', () => {
    const part = {
      type: PartType.Attribute,
      node: document.createElement('div'),
      name: 'class',
    } as const;
    const host = new MockUpdateHost();
    const updater = new SyncUpdater();
    const context = new UpdateContext(host, updater, new MockBlock());

    const value = 'foo';
    const binding = resolveBinding(value, part, context);

    expect(binding).toBeInstanceOf(AttributeBinding);
    expect(binding.value).toBe(value);
    expect(binding.part).toBe(part);
    expect(context.isPending()).toBe(false);
  });

  it('should resolve the value as a EventBinding if the part is a EventPart', () => {
    const part = {
      type: PartType.Event,
      node: document.createElement('div'),
      name: 'hello',
    } as const;
    const host = new MockUpdateHost();
    const updater = new SyncUpdater();
    const context = new UpdateContext(host, updater, new MockBlock());

    const value = vi.fn();
    const binding = resolveBinding(value, part, context);

    expect(binding).toBeInstanceOf(EventBinding);
    expect(binding.value).toBe(value);
    expect(binding.part).toBe(part);
    expect(context.isPending()).toBe(false);
  });

  it('should resolve the value as a PropertyBinding if the part is a PropertyPart', () => {
    const part = {
      type: PartType.Property,
      node: document.createElement('div'),
      name: 'className',
    } as const;
    const host = new MockUpdateHost();
    const updater = new SyncUpdater();
    const context = new UpdateContext(host, updater, new MockBlock());

    const value = 'foo';
    const binding = resolveBinding(value, part, context);

    expect(binding).toBeInstanceOf(PropertyBinding);
    expect(binding.value).toBe(value);
    expect(binding.part).toBe(part);
    expect(context.isPending()).toBe(false);
  });

  it('should resolve the value as a NodeBinding if the part is a NodePart', () => {
    const part = {
      type: PartType.Node,
      node: document.createTextNode(''),
    } as const;
    const host = new MockUpdateHost();
    const updater = new SyncUpdater();
    const context = new UpdateContext(host, updater, new MockBlock());

    const value = 'foo';
    const binding = resolveBinding(value, part, context);

    expect(binding).toBeInstanceOf(NodeBinding);
    expect(binding.value).toBe(value);
    expect(context.isPending()).toBe(false);
  });

  it('should resolve the value as a NodeBinding if the part is a ChildNodePart', () => {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
    } as const;
    const host = new MockUpdateHost();
    const updater = new SyncUpdater();
    const context = new UpdateContext(host, updater, new MockBlock());

    const value = 'foo';
    const binding = resolveBinding(value, part, context);

    expect(binding).toBeInstanceOf(NodeBinding);
    expect(binding.value).toBe(value);
    expect(binding.part).toBe(part);
    expect(context.isPending()).toBe(false);
  });

  it('should resolve the value as a ElementBinding if the part is a ElementPart', () => {
    const part = {
      type: PartType.Element,
      node: document.createElement('div'),
    } as const;
    const host = new MockUpdateHost();
    const updater = new SyncUpdater();
    const context = new UpdateContext(host, updater, new MockBlock());

    const value = {
      class: 'foo',
      title: 'bar',
    };
    const binding = resolveBinding(value, part, context);

    binding.connect(context);
    context.flushUpdate();

    expect(binding).toBeInstanceOf(ElementBinding);
    expect(binding.value).toBe(value);
    expect(binding.part).toBe(part);
    expect(context.isPending()).toBe(false);
  });
});
