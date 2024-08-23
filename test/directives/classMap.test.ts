import { describe, expect, it, vi } from 'vitest';

import { PartType, UpdateContext, directiveTag } from '../../src/baseTypes.js';
import { ClassMapBinding, classMap } from '../../src/directives/classMap.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockBlock, MockUpdateHost } from '../mocks.js';

describe('classMap()', () => {
  it('should construct a ClassMap directive', () => {
    const classDeclaration = { foo: true };
    const value = classMap(classDeclaration);

    expect(value.classes).toBe(classDeclaration);
  });
});

describe('ClassMapDirective', () => {
  describe('[directiveTag]()', () => {
    it('should create a new ClassMapBinding', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = classMap({ foo: true });
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const binding = value[directiveTag](part, context);

      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
    });

    it('should throw an error if the part does not indicate "class" attribute', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = classMap({ foo: true });
      const part = {
        type: PartType.Attribute,
        name: 'className',
        node: document.createElement('div'),
      } as const;

      expect(() => value[directiveTag](part, context)).toThrow(
        'ClassMap directive must be used in a "class" attribute,',
      );
    });
  });
});

describe('ClassMapBinding', () => {
  describe('.connect()', () => {
    it('should add properties whose values are true as classes to the element', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = classMap({
        foo: true,
        bar: false,
        baz: true,
      });
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const binding = new ClassMapBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      expect(part.node.classList).toHaveLength(2);
      expect(part.node.classList).toContain('foo');
      expect(part.node.classList).toContain('baz');
    });

    it('should do nothing if the update is already scheduled', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = classMap({
        foo: true,
        bar: false,
        baz: true,
      });
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
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
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value1 = classMap({
        foo: true,
        bar: false,
        baz: true,
      });
      const value2 = classMap({
        foo: false,
        bar: true,
      });
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const binding = new ClassMapBinding(value1, part);

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);
      context.flushUpdate();

      expect(binding.value).toBe(value2);
      expect(part.node.classList).toHaveLength(1);
      expect(part.node.classList).toContain('bar');
    });

    it('should skip an update if the new classes are the same as old ones', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value1 = classMap({
        foo: true,
        bar: false,
        baz: true,
      });
      const value2 = classMap(value1.classes);
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const binding = new ClassMapBinding(value1, part);

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);

      expect(binding.value).toBe(value2);
      expect(context.isPending()).toBe(false);
    });

    it('should throw an error if the new value is not ClassMap', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = classMap({
        foo: true,
      });
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
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
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = classMap({
        foo: true,
        bar: false,
        baz: true,
      });
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const binding = new ClassMapBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      binding.unbind(context);
      context.flushUpdate();

      expect(part.node.classList).toHaveLength(0);
    });

    it('should skip an update if the current classes have not been comitted', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = classMap({});
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const binding = new ClassMapBinding(value, part);

      binding.unbind(context);

      expect(context.isPending()).toBe(false);
    });

    it('should cancel mounting', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = classMap({
        foo: true,
      });
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const binding = new ClassMapBinding(value, part);

      binding.connect(context);
      binding.unbind(context);
      context.flushUpdate();

      expect(part.node.className).toBe('');
    });
  });

  describe('.disconnect()', () => {
    it('should cancel mounting', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = classMap({
        foo: true,
      });
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const binding = new ClassMapBinding(value, part);

      binding.connect(context);
      binding.disconnect(context);
      context.flushUpdate();

      expect(part.node.className).toBe('');
    });
  });
});
