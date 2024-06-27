import { describe, expect, it, vi } from 'vitest';

import {
  AttributeBinding,
  ElementBinding,
  EventBinding,
  NodeBinding,
  PropertyBinding,
  directiveTag,
  ensureDirective,
  isDirective,
  mount,
  resolveBinding,
} from '../src/binding.js';
import { type Part, PartType } from '../src/types.js';
import { SyncUpdater } from '../src/updater/syncUpdater.js';
import { MockBinding, MockDirective, MockRenderingEngine } from './mocks.js';

describe('AttributeBinding', () => {
  describe('.constructor()', () => {
    it('should construct a new AttributeBinding', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Attribute,
        node: element,
        name: 'class',
      } as const;
      const binding = new AttributeBinding('foo', part);

      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(element);
      expect(binding.endNode).toBe(element);
      expect(binding.value).toBe('foo');
    });
  });

  describe('.bind()', () => {
    it('should update the attribute with the passed string', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Attribute,
        node: element,
        name: 'class',
      } as const;
      const binding = new AttributeBinding('foo', part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      binding.connect(updater);
      updater.flush();

      expect(binding.value).toBe('foo');
      expect(element.getAttribute('class')).toBe('foo');

      binding.bind('bar', updater);
      updater.flush();

      expect(binding.value).toBe('bar');
      expect(element.getAttribute('class')).toBe('bar');
    });

    it('should update the attribute with the string representation of the object', () => {
      const obj1 = {
        toString() {
          return 'foo';
        },
      };
      const obj2 = {
        toString() {
          return 'bar';
        },
      };
      const element = document.createElement('div');
      const part = {
        type: PartType.Attribute,
        node: element,
        name: 'class',
      } as const;
      const binding = new AttributeBinding(obj1, part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      binding.connect(updater);
      updater.flush();

      expect(binding.value).toBe(obj1);
      expect(element.getAttribute('class')).toBe('foo');

      binding.bind(obj2, updater);
      updater.flush();

      expect(binding.value).toBe(obj2);
      expect(element.getAttribute('class')).toBe('bar');
    });

    it('should toggle the attribute according to the boolean value', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Attribute,
        node: element,
        name: 'contenteditable',
      } as const;
      const binding = new AttributeBinding(true, part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      binding.connect(updater);
      updater.flush();

      expect(binding.value).toBe(true);
      expect(element.hasAttribute('contenteditable')).toBe(true);

      binding.bind(false, updater);
      updater.flush();

      expect(binding.value).toBe(false);
      expect(element.hasAttribute('contenteditable')).toBe(false);
    });

    it('should remove the attribute when null is passed', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Attribute,
        node: element,
        name: 'contenteditable',
      } as const;
      const binding = new AttributeBinding(null, part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      element.toggleAttribute('contenteditable', true);
      binding.connect(updater);
      updater.flush();

      expect(binding.value).toBe(null);
      expect(element.hasAttribute('contenteditable')).toBe(false);
    });

    it('should remove the attribute when undefined is passed', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Attribute,
        node: element,
        name: 'contenteditable',
      } as const;
      const binding = new AttributeBinding(undefined, part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      element.toggleAttribute('contenteditable', true);
      binding.connect(updater);
      updater.flush();

      expect(binding.value).toBe(undefined);
      expect(element.hasAttribute('contenteditable')).toBe(false);
    });

    it('should not update the binding if the new and old values are the same', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Attribute,
        node: element,
        name: 'class',
      } as const;
      const binding = new AttributeBinding('foo', part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      binding.bind('foo', updater);

      expect(binding.value).toBe('foo');
      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });

    it('should do nothing if the update is already scheduled', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Attribute,
        node: element,
        name: 'contenteditable',
      } as const;
      const binding = new AttributeBinding(undefined, part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
        'enqueueMutationEffect',
      );

      binding.connect(updater);
      binding.connect(updater);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });

    it('should throw the error if the value is a directive', () => {
      expect(() => {
        const binding = new AttributeBinding(null, {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: 'class',
        });
        const engine = new MockRenderingEngine();
        const updater = new SyncUpdater(engine);
        binding.bind(new MockDirective(), updater);
      }).toThrow('A value must not be a directive,');
    });
  });

  describe('.unbind()', () => {
    it('should remove the attribute', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Attribute,
        node: element,
        name: 'contenteditable',
      } as const;
      const binding = new AttributeBinding(true, part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      element.toggleAttribute('contenteditable', true);
      binding.unbind(updater);
      updater.flush();

      expect(binding.value).toBe(null);
      expect(element.hasAttribute('contenteditable')).toBe(false);
    });

    it('should do nothing if the update is already scheduled', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Attribute,
        node: element,
        name: 'contenteditable',
      } as const;
      const binding = new AttributeBinding(undefined, part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
        'enqueueMutationEffect',
      );

      binding.unbind(updater);
      binding.unbind(updater);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Attribute,
        node: element,
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
      const listener = () => {};
      const element = document.createElement('div');
      const part = {
        type: PartType.Event,
        node: element,
        name: 'hello',
      } as const;
      const binding = new EventBinding(listener, part);

      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(element);
      expect(binding.endNode).toBe(element);
      expect(binding.value).toBe(listener);
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
        'A value of EventBinding must be EventListener, EventListenerObject or null.',
      );
      expect(() => {
        new EventBinding(undefined, {
          type: PartType.Event,
          node: document.createElement('div'),
          name: 'hello',
        });
      }).toThrow(
        'A value of EventBinding must be EventListener, EventListenerObject or null.',
      );
    });
  });

  describe('.bind()', () => {
    it('should connect the function to the element as an event listener', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const event = new CustomEvent('hello');
      const element = document.createElement('div');
      const part = {
        type: PartType.Event,
        node: element,
        name: 'hello',
      } as const;
      const binding = new EventBinding(listener1, part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');

      binding.connect(updater);
      updater.flush();
      element.dispatchEvent(event);

      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith('hello', binding);
      expect(listener1).toHaveBeenCalledOnce();
      expect(listener1).toHaveBeenCalledWith(event);
      expect(listener2).not.toHaveBeenCalled();

      binding.bind(listener2, updater);
      updater.flush();
      element.dispatchEvent(event);

      expect(listener1).toHaveBeenCalledOnce();
      expect(listener2).toHaveBeenCalledWith(event);
    });

    it('should connect the object to the element as an event listener', () => {
      const listener1 = {
        capture: true,
        handleEvent: vi.fn(),
      };
      const listener2 = {
        capture: false,
        handleEvent: vi.fn(),
      };
      const event = new CustomEvent('hello');
      const element = document.createElement('div');
      const part = {
        type: PartType.Event,
        node: element,
        name: 'hello',
      } as const;
      const binding = new EventBinding(listener1, part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');

      binding.connect(updater);
      updater.flush();
      element.dispatchEvent(event);

      expect(addEventListenerSpy).toHaveBeenCalledTimes(1);
      expect(addEventListenerSpy).toHaveBeenLastCalledWith(
        'hello',
        binding,
        listener1,
      );
      expect(listener1.handleEvent).toHaveBeenCalledOnce();
      expect(listener1.handleEvent).toHaveBeenCalledWith(event);
      expect(listener2.handleEvent).not.toHaveBeenCalled();

      binding.bind(listener2, updater);
      updater.flush();
      element.dispatchEvent(event);

      expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
      expect(addEventListenerSpy).toHaveBeenLastCalledWith(
        'hello',
        binding,
        listener2,
      );
      expect(removeEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'hello',
        binding,
        listener1,
      );
      expect(listener2.handleEvent).toHaveBeenCalledOnce();
      expect(listener2.handleEvent).toHaveBeenCalledWith(event);
    });

    it('should not connect the event listener if the new and current listeners are the same', () => {
      const listener = () => {};
      const element = document.createElement('div');
      const part = {
        type: PartType.Event,
        node: element,
        name: 'hello',
      } as const;
      const binding = new EventBinding(listener, part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');

      binding.connect(updater);
      updater.flush();

      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).not.toHaveBeenCalled();

      binding.bind(listener, updater);

      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });

    it('should unbind the active event listener when null is passed', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Event,
        node: element,
        name: 'hello',
      } as const;
      const listener = vi.fn();
      const event = new CustomEvent('hello');
      const binding = new EventBinding(listener, part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');

      binding.connect(updater);
      updater.flush();
      element.dispatchEvent(event);

      binding.bind(null, updater);
      updater.flush();
      element.dispatchEvent(event);

      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith('hello', binding);
      expect(removeEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('hello', binding);
      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(event);
    });

    it('should do nothing if the update is already scheduled', () => {
      const listener = () => {};
      const element = document.createElement('div');
      const part = {
        type: PartType.Event,
        node: element,
        name: 'click',
      } as const;
      const binding = new EventBinding(listener, part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
        'enqueueMutationEffect',
      );

      binding.connect(updater);
      binding.connect(updater);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });

    it('should throw the error if the value other than an event listner or null is assigned', () => {
      expect(() => {
        const binding = new EventBinding(null, {
          type: PartType.Event,
          node: document.createElement('div'),
          name: 'hello',
        });
        const engine = new MockRenderingEngine();
        const updater = new SyncUpdater(engine);
        binding.bind({}, updater);
      }).toThrow(
        'A value of EventBinding must be EventListener, EventListenerObject or null.',
      );
      expect(() => {
        const binding = new EventBinding(null, {
          type: PartType.Event,
          node: document.createElement('div'),
          name: 'hello',
        });
        const engine = new MockRenderingEngine();
        const updater = new SyncUpdater(engine);
        binding.bind(undefined, updater);
      }).toThrow(
        'A value of EventBinding must be EventListener, EventListenerObject or null.',
      );
    });
  });

  describe('.unbind()', () => {
    it('should unbind the active event listener', () => {
      const listener = vi.fn();
      const element = document.createElement('div');
      const part = {
        type: PartType.Event,
        node: element,
        name: 'hello',
      } as const;
      const event = new CustomEvent('hello');
      const binding = new EventBinding(listener, part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');

      binding.connect(updater);
      updater.flush();
      element.dispatchEvent(event);

      binding.unbind(updater);
      updater.flush();
      element.dispatchEvent(event);

      expect(binding.value).toBe(null);
      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith('hello', binding);
      expect(removeEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('hello', binding);
      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(event);
    });

    it('should do nothing if the update is already scheduled', () => {
      const listener = () => {};
      const element = document.createElement('div');
      const part = {
        type: PartType.Event,
        node: element,
        name: 'click',
      } as const;
      const binding = new EventBinding(listener, part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      binding.connect(updater);

      updater.flush();

      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
        'enqueueMutationEffect',
      );

      binding.unbind(updater);
      binding.unbind(updater);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });

    it('should do nothing if there is no active listner', () => {
      const listener = () => {};
      const element = document.createElement('div');
      const part = {
        type: PartType.Event,
        node: element,
        name: 'click',
      } as const;
      const binding = new EventBinding(listener, part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);
      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
        'enqueueMutationEffect',
      );

      binding.unbind(updater);
      binding.unbind(updater);

      expect(enqueueMutationEffectSpy).not.toHaveBeenCalled();
    });
  });

  describe('.disconnect()', () => {
    it('should unregister the active event listener function', () => {
      const listener = () => {};
      const element = document.createElement('div');
      const part = {
        type: PartType.Event,
        node: element,
        name: 'hello',
      } as const;
      const binding = new EventBinding(listener, part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');

      binding.connect(updater);
      updater.flush();

      binding.disconnect();

      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith('hello', binding);
      expect(removeEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('hello', binding);
      expect(binding.value).toBe(null);
    });

    it('should unregister the active event listener object', () => {
      const listener = { handleEvent: () => {}, capture: true };
      const element = document.createElement('div');
      const part = {
        type: PartType.Event,
        node: element,
        name: 'hello',
      } as const;
      const binding = new EventBinding(listener, part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');

      binding.connect(updater);
      updater.flush();

      binding.disconnect();

      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'hello',
        binding,
        listener,
      );
      expect(removeEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'hello',
        binding,
        listener,
      );
      expect(binding.value).toBe(null);
    });

    it('should cancel register an event listener function', () => {
      const listener = () => {};
      const element = document.createElement('div');
      const part = {
        type: PartType.Event,
        node: element,
        name: 'hello',
      } as const;
      const binding = new EventBinding(listener, part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');

      binding.connect(updater);
      binding.disconnect();
      updater.flush();

      expect(addEventListenerSpy).not.toHaveBeenCalled();
      expect(removeEventListenerSpy).not.toHaveBeenCalledOnce();
    });

    it('should cancel register an event listener object', () => {
      const listener = { handleEvent: () => {}, capture: true };
      const element = document.createElement('div');
      const part = {
        type: PartType.Event,
        node: element,
        name: 'hello',
      } as const;
      const binding = new EventBinding(listener, part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');

      binding.connect(updater);
      binding.disconnect();
      updater.flush();

      expect(addEventListenerSpy).not.toHaveBeenCalled();
      expect(removeEventListenerSpy).not.toHaveBeenCalledOnce();
    });
  });
});

describe('NodeBinding', () => {
  describe('.constructor()', () => {
    it('should construct a new NodeBinding', () => {
      const listener = () => {};
      const element = document.createElement('div');
      const part = {
        type: PartType.Node,
        node: element,
      } as const;
      const binding = new NodeBinding(listener, part);

      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(element);
      expect(binding.endNode).toBe(element);
      expect(binding.value).toBe(listener);
    });
  });

  describe('.bind()', () => {
    it('should update the value of the node', () => {
      const node = document.createTextNode('');
      const part = {
        type: PartType.Node,
        node,
      } as const;
      const binding = new NodeBinding('foo', part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      binding.connect(updater);
      updater.flush();

      expect(binding.value).toBe('foo');
      expect(node.nodeValue).toBe('foo');

      binding.bind('bar', updater);
      updater.flush();

      expect(binding.value).toBe('bar');
      expect(node.nodeValue).toBe('bar');

      binding.bind(null, updater);
      updater.flush();
      updater.flush();

      expect(binding.value).toBe(null);
      expect(node.nodeValue).toBe('');
    });

    it('should not update the binding if the new and old values are the same', () => {
      const node = document.createTextNode('');
      const part = {
        type: PartType.Node,
        node,
      } as const;
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);
      const binding = new NodeBinding('foo', part);

      binding.bind('foo', updater);

      expect(binding.value).toBe('foo');
      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });

    it('should do nothing if the update is already scheduled', () => {
      const node = document.createTextNode('');
      const part = {
        type: PartType.Node,
        node,
      } as const;
      const binding = new NodeBinding(undefined, part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);
      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
        'enqueueMutationEffect',
      );

      binding.connect(updater);
      binding.connect(updater);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });

    it('should throw the error if the value is a directive', () => {
      expect(() => {
        const binding = new NodeBinding('foo', {
          type: PartType.Node,
          node: document.createElement('div'),
        });
        const engine = new MockRenderingEngine();
        const updater = new SyncUpdater(engine);
        binding.bind(new MockDirective(), updater);
      }).toThrow('A value must not be a directive,');
    });
  });

  describe('.unbind()', () => {
    it('should set null to the value of the node', () => {
      const node = document.createTextNode('');
      const part = {
        type: PartType.Node,
        node,
      } as const;
      const binding = new NodeBinding('foo', part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      binding.connect(updater);
      updater.flush();

      expect(binding.value).toBe('foo');
      expect(node.nodeValue).toBe('foo');

      binding.unbind(updater);
      updater.flush();

      expect(binding.value).toBe(null);
      expect(node.nodeValue).toBe('');
    });

    it('should do nothing if the update is already scheduled', () => {
      const node = document.createTextNode('');
      const part = {
        type: PartType.Node,
        node,
      } as const;
      const binding = new NodeBinding(undefined, part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);
      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
        'enqueueMutationEffect',
      );

      binding.unbind(updater);
      binding.unbind(updater);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const node = document.createTextNode('');
      const part = {
        type: PartType.Node,
        node,
      } as const;
      const binding = new NodeBinding('foo', part);

      binding.disconnect();
    });
  });
});

describe('PropertyBinding', () => {
  describe('.constructor()', () => {
    it('should construct a new PropertyBinding', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Property,
        node: element,
        name: 'className',
      } as const;
      const binding = new PropertyBinding('foo', part);

      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(element);
      expect(binding.endNode).toBe(element);
      expect(binding.value).toBe('foo');
    });
  });

  describe('.bind()', () => {
    it('should update the property of the element', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Property,
        node: element,
        name: 'className',
      } as const;
      const binding = new PropertyBinding('foo', part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      binding.connect(updater);
      updater.flush();

      expect(binding.value).toBe('foo');
      expect(element.className).toBe('foo');

      binding.bind('bar', updater);
      updater.flush();

      expect(binding.value).toBe('bar');
      expect(element.className).toBe('bar');
    });

    it('should not update the binding if the new and old values are the same', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Property,
        node: element,
        name: 'className',
      } as const;
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);
      const binding = new PropertyBinding('foo', part);

      binding.bind('foo', updater);

      expect(binding.value).toBe('foo');
      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });

    it('should do nothing if the update is already scheduled', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Property,
        node: element,
        name: 'className',
      } as const;
      const binding = new PropertyBinding(undefined, part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);
      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
        'enqueueMutationEffect',
      );

      binding.connect(updater);
      binding.connect(updater);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });

    it('should throw the error if the value is a directive', () => {
      expect(() => {
        const binding = new PropertyBinding('foo', {
          type: PartType.Property,
          node: document.createElement('div'),
          name: 'className',
        });
        const engine = new MockRenderingEngine();
        const updater = new SyncUpdater(engine);
        binding.bind(new MockDirective(), updater);
      }).toThrow('A value must not be a directive,');
    });
  });

  describe('.unbind()', () => {
    it('should do nothing', () => {
      const element = document.createElement('div');
      const setterSpy = vi.spyOn(element, 'className', 'set');
      const part = {
        type: PartType.Property,
        node: element,
        name: 'className',
      } as const;
      const binding = new PropertyBinding('foo', part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      binding.unbind(updater);
      updater.flush();

      expect(setterSpy).not.toHaveBeenCalled();
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const element = document.createElement('div');
      const setterSpy = vi.spyOn(element, 'className', 'set');
      const part = {
        type: PartType.Property,
        node: element,
        name: 'className',
      } as const;
      const binding = new PropertyBinding('foo', part);
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      binding.disconnect();
      updater.flush();

      expect(setterSpy).not.toHaveBeenCalled();
    });
  });
});

describe('ElementBinding', () => {
  describe('.constructor()', () => {
    it('should construct a new ElementBinding', () => {
      const props = {};
      const element = document.createElement('div');
      const part = {
        type: PartType.Element,
        node: element,
      } as const;
      const binding = new ElementBinding(props, part);

      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(element);
      expect(binding.endNode).toBe(element);
      expect(binding.value).toBe(props);
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
      expect(() => {
        const binding = new ElementBinding(
          {},
          {
            type: PartType.Element,
            node: document.createElement('div'),
          },
        );
        const engine = new MockRenderingEngine();
        const updater = new SyncUpdater(engine);
        binding.bind(null, updater);
      }).toThrow('A value of ElementBinding must be an object,');
    });
  });

  describe('.connect()', () => {
    it('should bind element attributes', () => {
      const props = {
        class: 'foo',
        title: 'bar',
      };
      const element = document.createElement('div');
      const part = {
        type: PartType.Element,
        node: element,
      } as const;
      const binding = new ElementBinding(props, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.connect(updater);
      updater.flush();

      expect(element.getAttribute('class')).toBe('foo');
      expect(element.getAttribute('title')).toBe('bar');
    });

    it('should bind element properities by properities starting with "."', () => {
      const props = {
        '.className': 'foo',
        '.title': 'bar',
      };
      const element = document.createElement('div');
      const part = {
        type: PartType.Element,
        node: element,
      } as const;
      const binding = new ElementBinding(props, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.connect(updater);
      updater.flush();

      expect(element.className).toBe('foo');
      expect(element.title).toBe('bar');
    });

    it('should bind event listeners by properities starting with "@"', () => {
      const props = {
        '@click': () => {},
        '@touchstart': () => {},
      };
      const element = document.createElement('div');
      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');
      const part = {
        type: PartType.Element,
        node: element,
      } as const;
      const binding = new ElementBinding(props, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.connect(updater);
      updater.flush();

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
      const props = {
        class: 'foo',
        title: 'bar',
      };
      const element = document.createElement('div');
      const part = {
        type: PartType.Element,
        node: element,
      } as const;
      const binding = new ElementBinding(props, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.connect(updater);
      updater.flush();

      binding.bind(props, updater);
      updater.flush();

      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });

    it('should skip properties that are passed the same value as last time', () => {
      const props = {
        class: 'foo',
        title: 'bar',
      };
      const element = document.createElement('div');
      const setAttributeSpy = vi.spyOn(element, 'setAttribute');
      const part = {
        type: PartType.Element,
        node: element,
      } as const;
      const binding = new ElementBinding(props, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.connect(updater);
      updater.flush();

      binding.bind(
        {
          class: 'foo', // same value as last time
          title: 'baz',
        },
        updater,
      );
      updater.flush();

      expect(setAttributeSpy).toHaveBeenCalledTimes(3);
      expect(setAttributeSpy).toHaveBeenCalledWith('class', 'foo');
      expect(setAttributeSpy).toHaveBeenCalledWith('title', 'bar');
      expect(setAttributeSpy).toHaveBeenCalledWith('title', 'baz');
      expect(element.getAttribute('class')).toBe('foo');
      expect(element.getAttribute('title')).toBe('baz');
    });

    it('should unbind bindings that no longer exists', () => {
      const props = {
        class: 'foo',
        title: 'bar',
      };
      const element = document.createElement('div');
      const part = {
        type: PartType.Element,
        node: element,
      } as const;
      const binding = new ElementBinding(props, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.connect(updater);
      updater.flush();

      binding.bind({ class: undefined }, updater);
      updater.flush();

      expect(element.hasAttribute('class')).toBe(false);
      expect(element.hasAttribute('title')).toBe(false);
    });
  });

  describe('.unbind()', () => {
    it('should unbind all bound properities', () => {
      const props = {
        class: 'foo',
        title: 'bar',
      };
      const element = document.createElement('div');
      const part = {
        type: PartType.Element,
        node: element,
      } as const;
      const binding = new ElementBinding(props, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.connect(updater);
      updater.flush();

      binding.unbind(updater);
      updater.flush();

      expect(element.hasAttribute('class')).toBe(false);
      expect(element.hasAttribute('title')).toBe(false);
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect all bound properities', () => {
      let disconnects = 0;

      const createMockDirective = () =>
        Object.assign(new MockDirective(), {
          [directiveTag](this: MockDirective, part: Part): MockBinding {
            return Object.assign(new MockBinding(this, part), {
              disconnect() {
                disconnects++;
              },
            });
          },
        });
      const props = {
        foo: createMockDirective(),
        bar: createMockDirective(),
      };
      const element = document.createElement('div');
      const part = {
        type: PartType.Element,
        node: element,
      } as const;
      const binding = new ElementBinding(props, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.connect(updater);
      updater.flush();

      binding.disconnect();

      expect(disconnects).toBe(2);
    });
  });
});

describe('ensureDirective', () => {
  it('should throw an error if the value is not instance of the expected class', () => {
    expect(() => ensureDirective(MockDirective, null)).toThrow(
      'A value must be a instance of "MockDirective", but got "null".',
    );
  });

  it('should do nothing if the value is instance of the expected class', () => {
    ensureDirective(MockDirective, new MockDirective());
  });
});

describe('resolveBinding()', () => {
  it('should perform the value if it is a directive', () => {
    const part = {
      type: PartType.Node,
      node: document.createTextNode(''),
    } as const;
    const directive = new MockDirective();
    const directiveSpy = vi.spyOn(directive, directiveTag);
    const engine = new MockRenderingEngine();
    const updater = new SyncUpdater(engine);
    const binding = resolveBinding(directive, part, updater);

    expect(binding).toBeInstanceOf(MockBinding);
    expect(directiveSpy).toHaveBeenCalledOnce();
    expect(directiveSpy).toHaveBeenCalledWith(part, updater);
  });

  it('should resolve the value as a AttributeBinding if the part is a AttributePart', () => {
    const element = document.createElement('div');
    const part = {
      type: PartType.Attribute,
      node: element,
      name: 'class',
    } as const;
    const engine = new MockRenderingEngine();
    const updater = new SyncUpdater(engine);
    const binding = resolveBinding('foo', part, updater);

    expect(binding).toBeInstanceOf(AttributeBinding);
    expect(binding.value).toBe('foo');
    expect(updater.isPending()).toBe(false);
    expect(updater.isScheduled()).toBe(false);
  });

  it('should resolve the value as a EventBinding if the part is a EventPart', () => {
    const listener = vi.fn();
    const element = document.createElement('div');
    const part = {
      type: PartType.Event,
      node: element,
      name: 'hello',
    } as const;
    const engine = new MockRenderingEngine();
    const updater = new SyncUpdater(engine);
    const binding = resolveBinding(listener, part, updater);

    expect(binding).toBeInstanceOf(EventBinding);
    expect(binding.value).toBe(listener);
    expect(updater.isPending()).toBe(false);
    expect(updater.isScheduled()).toBe(false);
  });

  it('should resolve the value as a PropertyBinding if the part is a PropertyPart', () => {
    const element = document.createElement('div');
    const part = {
      type: PartType.Property,
      node: element,
      name: 'className',
    } as const;
    const engine = new MockRenderingEngine();
    const updater = new SyncUpdater(engine);
    const binding = resolveBinding('foo', part, updater);

    expect(binding).toBeInstanceOf(PropertyBinding);
    expect(binding.value).toBe('foo');
    expect(updater.isPending()).toBe(false);
    expect(updater.isScheduled()).toBe(false);
  });

  it('should resolve the value as a NodeBinding if the part is a NodePart', () => {
    const node = document.createTextNode('');
    const part = {
      type: PartType.Node,
      node,
    } as const;
    const engine = new MockRenderingEngine();
    const updater = new SyncUpdater(engine);
    const binding = resolveBinding('foo', part, updater);

    expect(binding).toBeInstanceOf(NodeBinding);
    expect(binding.value).toBe('foo');
    expect(updater.isPending()).toBe(false);
    expect(updater.isScheduled()).toBe(false);
  });

  it('should resolve the value as a NodeBinding if the part is a ChildNodePart', () => {
    const node = document.createComment('');
    const part = {
      type: PartType.ChildNode,
      node,
    } as const;
    const engine = new MockRenderingEngine();
    const updater = new SyncUpdater(engine);
    const binding = resolveBinding('foo', part, updater);

    expect(binding).toBeInstanceOf(NodeBinding);
    expect(binding.value).toBe('foo');
    expect(updater.isPending()).toBe(false);
    expect(updater.isScheduled()).toBe(false);
  });

  it('should resolve the value as a ElementBinding if the part is a ElementPart', () => {
    const element = document.createElement('div');
    const part = {
      type: PartType.Element,
      node: element,
    } as const;
    const engine = new MockRenderingEngine();
    const updater = new SyncUpdater(engine);
    const props = {
      class: 'foo',
      title: 'bar',
    };
    const binding = resolveBinding(props, part, updater);

    binding.connect(updater);
    updater.flush();

    expect(binding).toBeInstanceOf(ElementBinding);
    expect(binding.value).toBe(props);
    expect(updater.isPending()).toBe(false);
    expect(updater.isScheduled()).toBe(false);
  });
});

describe('isDirective()', () => {
  it('should return true if the value is directive', () => {
    expect(isDirective(null)).toBe(false);
    expect(isDirective('')).toBe(false);
    expect(isDirective({})).toBe(false);
    expect(isDirective({ [directiveTag]: () => {} })).toBe(true);
  });
});

describe('mount()', () => {
  it('should mount element inside the container', async () => {
    const directive = new MockDirective();
    const container = document.createElement('div');
    const engine = new MockRenderingEngine();
    const updater = new SyncUpdater(engine);
    const directiveSpy = vi.spyOn(directive, directiveTag);
    const isScheduledSpy = vi.spyOn(updater, 'isScheduled');
    const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

    expect(mount(directive, container, updater)).toBeInstanceOf(MockBinding);
    expect(directiveSpy).toHaveBeenCalledOnce();
    expect(isScheduledSpy).toHaveBeenCalledOnce();
    expect(scheduleUpdateSpy).toHaveBeenCalled();

    await updater.waitForUpdate();

    expect(container.innerHTML).toBe('<!---->');
  });

  it('should not schedule update if it is already scheduled', () => {
    const directive = new MockDirective();
    const container = document.createElement('div');
    const engine = new MockRenderingEngine();
    const updater = new SyncUpdater(engine);
    const directiveSpy = vi.spyOn(directive, directiveTag);
    const isScheduledSpy = vi
      .spyOn(updater, 'isScheduled')
      .mockReturnValue(true);
    const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

    expect(mount(directive, container, updater)).toBeInstanceOf(MockBinding);
    expect(container.innerHTML).toBe('');
    expect(directiveSpy).toHaveBeenCalledOnce();
    expect(isScheduledSpy).toHaveBeenCalledOnce();
    expect(scheduleUpdateSpy).not.toHaveBeenCalled();
  });
});
