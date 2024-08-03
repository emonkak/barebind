import { describe, expect, it, vi } from 'vitest';

import { PartType, UpdateContext, directiveTag } from '../../src/baseTypes.js';
import { ClassMapBinding, classMap } from '../../src/directives/classMap.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockUpdateHost } from '../mocks.js';

describe('classMap()', () => {
  it('should construct a ClassMap directive', () => {
    const classDeclaration = { foo: true };
    const value = classMap(classDeclaration);

    expect(value.classes).toBe(classDeclaration);
  });
});

describe('ClassMapDirective', () => {
  describe('[directiveTag]()', () => {
    it('should return a new ClassMapBinding', () => {
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value = classMap({ foo: true });
      const binding = value[directiveTag](part, context);

      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
    });

    it('should throw an error if the part does not indicate "class" attribute', () => {
      const part = {
        type: PartType.Attribute,
        name: 'className',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value = classMap({ foo: true });

      expect(() => value[directiveTag](part, context)).toThrow(
        'ClassMap directive must be used in a "class" attribute,',
      );
    });
  });
});

describe('ClassMapBinding', () => {
  describe('.connect()', () => {
    it('should add properties whose values are true as classes to the element', () => {
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value = classMap({
        foo: true,
        bar: false,
        baz: true,
      });
      const binding = new ClassMapBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      expect(part.node.classList).toHaveLength(2);
      expect(part.node.classList).toContain('foo');
      expect(part.node.classList).toContain('baz');
    });

    it('should do nothing if the update is already scheduled', () => {
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value = classMap({
        foo: true,
        bar: false,
        baz: true,
      });
      const binding = new ClassMapBinding(value, part);

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
    it('should remove classes whose values are false from the element', () => {
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value1 = classMap({
        foo: true,
        bar: false,
        baz: true,
      });
      const value2 = classMap({
        foo: false,
        bar: true,
      });
      const binding = new ClassMapBinding(value1, part);

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);
      context.flushUpdate();

      expect(binding.value).toBe(value2);
      expect(part.node.classList).toHaveLength(1);
      expect(part.node.classList).toContain('bar');
    });

    it('should skip an update if the classes are the same as previous ones', () => {
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value1 = classMap({
        foo: true,
        bar: false,
        baz: true,
      });
      const value2 = classMap(value1.classes);
      const binding = new ClassMapBinding(value1, part);

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);

      expect(binding.value).toBe(value2);
      expect(context.isPending()).toBe(false);
    });

    it('should throw an error if the new value is not ClassMap', () => {
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value = classMap({
        foo: true,
      });
      const binding = new ClassMapBinding(value, part);

      expect(() => {
        binding.bind(null as any, context);
      }).toThrow(
        'A value must be a instance of ClassMap directive, but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should remove all classes from the element', () => {
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value = classMap({
        foo: true,
        bar: false,
        baz: true,
      });
      const binding = new ClassMapBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      binding.unbind(context);
      context.flushUpdate();

      expect(part.node.classList).toHaveLength(0);
    });

    it('should skip an update if the current properties are empty', () => {
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value = classMap({});
      const binding = new ClassMapBinding(value, part);

      binding.unbind(context);

      expect(context.isPending()).toBe(false);
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;

      const value = classMap({
        foo: true,
      });
      const binding = new ClassMapBinding(value, part);

      binding.disconnect();
    });
  });
});
