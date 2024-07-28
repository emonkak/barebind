import { describe, expect, it, vi } from 'vitest';

import { ClassMapBinding, classMap } from '../../src/directives/classMap.js';
import { PartType, directiveTag } from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockRenderHost } from '../mocks.js';

describe('classMap()', () => {
  it('should construct a ClassMap', () => {
    const classDeclaration = { foo: true };
    const directive = classMap(classDeclaration);

    expect(directive.classDeclaration).toBe(classDeclaration);
  });
});

describe('ClassMapDirective', () => {
  describe('[directiveTag]()', () => {
    it('should return a new instance of ClassMapBinding', () => {
      const classDeclaration = { foo: true };
      const directive = classMap(classDeclaration);
      const updater = new SyncUpdater(new MockRenderHost());
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const binding = directive[directiveTag](part, updater);

      expect(binding.value).toBe(directive);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
    });

    it('should throw an error if the part does not indicate "class" attribute', () => {
      const classDeclaration = { foo: true };
      const directive = classMap(classDeclaration);
      const updater = new SyncUpdater(new MockRenderHost());
      const part = {
        type: PartType.Attribute,
        name: 'className',
        node: document.createElement('div'),
      } as const;

      expect(() => directive[directiveTag](part, updater)).toThrow(
        'ClassMap directive must be used in a "class" attribute,',
      );
    });
  });
});

describe('ClassMapBinding', () => {
  describe('.connect()', () => {
    it('should add properties whose values are true as classes to the element', () => {
      const directive = classMap({
        foo: true,
        bar: false,
        baz: true,
      });
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const binding = new ClassMapBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderHost());

      binding.connect(updater);
      updater.flush();

      expect(part.node.classList).toHaveLength(2);
      expect(part.node.classList).toContain('foo');
      expect(part.node.classList).toContain('baz');
    });

    it('should do nothing if the update is already scheduled', () => {
      const directive = classMap({
        foo: true,
        bar: false,
        baz: true,
      });
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const binding = new ClassMapBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderHost());
      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
        'enqueueMutationEffect',
      );

      binding.connect(updater);
      binding.connect(updater);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });
  });

  describe('.bind()', () => {
    it('should remove classes whose values are false from the element', () => {
      const directive1 = classMap({
        foo: true,
        bar: false,
        baz: true,
      });
      const directive2 = classMap({
        foo: false,
        bar: true,
      });
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const binding = new ClassMapBinding(directive1, part);
      const updater = new SyncUpdater(new MockRenderHost());

      binding.connect(updater);
      updater.flush();

      binding.bind(directive2, updater);
      updater.flush();

      expect(binding.value).toBe(directive2);
      expect(part.node.classList).toHaveLength(1);
      expect(part.node.classList).toContain('bar');
    });

    it('should skip an update if the classes are the same as previous ones', () => {
      const directive1 = classMap({
        foo: true,
        bar: false,
        baz: true,
      });
      const directive2 = classMap(directive1.classDeclaration);
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const binding = new ClassMapBinding(directive1, part);
      const updater = new SyncUpdater(new MockRenderHost());

      binding.connect(updater);
      updater.flush();

      binding.bind(directive2, updater);

      expect(binding.value).toBe(directive1);
      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });

    it('should throw an error if the new value is not ClassMap', () => {
      const directive = classMap({
        foo: true,
      });
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const binding = new ClassMapBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderHost());

      expect(() => {
        binding.bind(null as any, updater);
      }).toThrow(
        'A value must be a instance of ClassMap directive, but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should remove all classes from the element', () => {
      const directive = classMap({
        foo: true,
        bar: false,
        baz: true,
      });
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const binding = new ClassMapBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderHost());

      binding.connect(updater);
      updater.flush();

      binding.unbind(updater);
      updater.flush();

      expect(part.node.classList).toHaveLength(0);
    });

    it('should skip an update if the current properties are empty', () => {
      const directive = classMap({});
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const binding = new ClassMapBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderHost());

      binding.unbind(updater);

      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const directive = classMap({
        foo: true,
      });
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const binding = new ClassMapBinding(directive, part);

      binding.disconnect();
    });
  });
});
