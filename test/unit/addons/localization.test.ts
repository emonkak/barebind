import { describe, expect, it } from 'vitest';
import { LocaleContext } from '@/addons/localization.js';
import { TestRenderer } from '../../test-renderer.js';

describe('LocaleContext', () => {
  describe('static [$hook]()', () => {
    it('should return a registered LocaleContext', () => {
      const localeContext = new LocaleContext({
        hello: (name: string) => `Hello, ${name}!`,
      });

      const renderer = new TestRenderer((_props, session) => {
        session.use(localeContext);
        return session.use(LocaleContext);
      });

      expect(renderer.render({})).toBe(localeContext);
    });

    it('should throw an error if LocaleContext is not registered', () => {
      const renderer = new TestRenderer((_props, session) => {
        session.use(LocaleContext);
      });

      expect(() => {
        renderer.render({});
      }).toThrow('No locale context found.');
    });
  });

  describe('localize()', () => {
    const context = new LocaleContext({
      hello: (name: string) => `Hello, ${name}!`,
      helloEveryone: () => 'Hello, everyone!',
    });

    it('should call the message function with an argument', () => {
      const result = context.localize('hello', 'world');
      expect(result).toBe('Hello, world!');
    });

    it('should call the message function with no arguments', () => {
      const result = context.localize('helloEveryone');
      expect(result).toBe('Hello, everyone!');
    });

    it('should throw an error when the key does not exist', () => {
      expect(() => context.localize('nonExistentKey' as any)).toThrowError(
        'No message found for key "nonExistentKey" in locale.',
      );
    });
  });
});
