import { describe, expect, it, vi } from 'vitest';
import { createEventPart } from '@/dom/part.js';
import { DOMEvent, DOMEventBinding } from '@/dom/primitive/event.js';
import { createTestRuntime } from '../../../adapter.js';
import { SessionLauncher } from '../../../session-launcher.js';

describe('DOMEvent', () => {
  describe('ensureValue()', () => {
    it('asserts the value is event listener or nullish', () => {
      const part = createEventPart(document.createElement('div'), 'click');

      expect(() => {
        DOMEvent.ensureValue(null, part);
        DOMEvent.ensureValue(undefined, part);
        DOMEvent.ensureValue(() => {}, part);
        DOMEvent.ensureValue({ handleEvent: () => {} }, part);
      }).not.toThrow();
    });

    it('throws an error when the value is not event listener or nullish', () => {
      const part = createEventPart(document.createElement('div'), 'click');

      expect(() => {
        DOMEvent.ensureValue({}, part);
      }).toThrow(
        'Event values must be EventListener, EventListenerObject, null or undefined.',
      );
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new binding with DOMEvent type', () => {
      const listener = () => {};
      const part = createEventPart(document.createElement('div'), 'click');
      const runtime = createTestRuntime();
      const binding = DOMEvent.resolveBinding(listener, part, runtime);

      expect(binding.type).toBe(DOMEvent);
      expect(binding.value).toBe(listener);
      expect(binding.part).toBe(part);
    });
  });
});

describe('DOMEventBinding', () => {
  const launcher = new SessionLauncher(createTestRuntime());

  describe('shouldUpdate()', () => {
    it('returns true when there is no current listener', () => {
      const listener = () => {};
      const part = createEventPart(document.createElement('div'), 'click');
      const binding = new DOMEventBinding(listener, part);

      expect(binding.shouldUpdate(listener)).toBe(true);
    });

    it('returns true when the event listener differs from the current one', () => {
      const listener = () => {};
      const part = createEventPart(document.createElement('div'), 'click');
      const binding = new DOMEventBinding(listener, part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(binding.shouldUpdate(listener)).toBe(false);
      expect(binding.shouldUpdate(() => {})).toBe(true);
    });
  });

  describe('commit()', () => {
    it('adds itself as an event listener with options', () => {
      const part = createEventPart(document.createElement('div'), 'click');
      const binding = new DOMEventBinding(
        { handleEvent: () => {}, capture: true },
        part,
      );
      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      launcher.launchSession((session) => {
        binding.value = { handleEvent: () => {}, capture: false };
        binding.attach(session);
        binding.commit();
      });

      expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'click',
        binding,
        expect.objectContaining({ capture: true }),
      );
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'click',
        binding,
        expect.objectContaining({ capture: false }),
      );
    });

    it('delegates events to current event listener functions', () => {
      const listener = vi.fn();
      const part = createEventPart(document.createElement('div'), 'click');
      const binding = new DOMEventBinding(listener, part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      part.node.dispatchEvent(new Event('click'));

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(expect.any(Event));
    });

    it('delegates events to current event listener objects', () => {
      const listener = { handleEvent: vi.fn() };
      const part = createEventPart(document.createElement('div'), 'click');
      const binding = new DOMEventBinding(listener, part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      part.node.dispatchEvent(new Event('click'));

      expect(listener.handleEvent).toHaveBeenCalledOnce();
      expect(listener.handleEvent).toHaveBeenCalledWith(expect.any(Event));
    });

    it.for([
      null,
      undefined,
    ])('aborts event delegations when the new listener is %s', (nullish) => {
      const listener = vi.fn();
      const part = createEventPart(document.createElement('div'), 'click');
      const binding = new DOMEventBinding(listener, part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      launcher.launchSession((session) => {
        binding.value = nullish;
        binding.attach(session);
        binding.commit();
      });

      part.node.dispatchEvent(new Event('click'));

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('rollback()', () => {
    it('does nothing when there is no curernt event listener', () => {
      const listener = () => {};
      const part = createEventPart(document.createElement('div'), 'click');
      const binding = new DOMEventBinding(listener, part);
      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      launcher.launchSession((session) => {
        binding.detach(session);
        binding.rollback();
      });

      expect(addEventListenerSpy).not.toHaveBeenCalled();
      expect(removeEventListenerSpy).not.toHaveBeenCalled();
    });

    it('removes itself as an event listener', () => {
      const listener = () => {};
      const part = createEventPart(document.createElement('div'), 'click');
      const binding = new DOMEventBinding(listener, part);
      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      launcher.launchSession((session) => {
        binding.detach(session);
        binding.rollback();
      });

      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'click',
        binding,
        expect.objectContaining({}),
      );
      expect(removeEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'click',
        binding,
        expect.objectContaining({}),
      );
    });
  });
});
