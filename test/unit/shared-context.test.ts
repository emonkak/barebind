import { describe, expect, it } from 'vitest';
import { SharedContext } from '@/shared-context.js';
import { TestRenderer } from '../test-renderer.js';

describe('SharedContext', () => {
  describe('static [$hook]()', () => {
    it('should return a registered SharedContext', () => {
      const myContext = new MyContext();

      const renderer = new TestRenderer((_props, session) => {
        session.use(myContext);
        return session.use(MyContext);
      });

      expect(renderer.render({})).toBe(myContext);
    });

    it('should throw an error if SharedContext is not registered', () => {
      const renderer = new TestRenderer((_props, session) => {
        session.use(MyContext);
      });

      expect(() => {
        renderer.render({});
      }).toThrow('No MyContext found.');
    });
  });
});

class MyContext extends SharedContext {}
