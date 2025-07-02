import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetScrollPosition } from '@/router/resetScrollPosition.js';
import { RelativeURL } from '@/router/url.js';
import { createElement } from '../../testUtils.js';

describe('resetScrollPosition', () => {
  const originalScrollRestoration = history.scrollRestoration;

  afterEach(() => {
    vi.restoreAllMocks();
    history.scrollRestoration = originalScrollRestoration;
  });

  it.each([['push'], ['reload'], ['replace'], ['traverse']] as const)(
    'scrolls to the top',
    (navigationType) => {
      const scrollToSpy = vi.spyOn(window, 'scrollTo');

      history.scrollRestoration = 'manual';

      resetScrollPosition({
        url: new RelativeURL('/foo'),
        state: null,
        navigationType,
      });

      expect(scrollToSpy).toHaveBeenCalled();
      expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
    },
  );

  it.each([['push'], ['reload'], ['replace'], ['traverse']] as const)(
    'scrolls to the element indicating hash',
    (navigationType) => {
      const element = createElement('div', {
        id: 'bar',
      });
      const scrollToSpy = vi.spyOn(window, 'scrollTo');
      const scrollIntoViewSpy = vi.spyOn(element, 'scrollIntoView');

      history.scrollRestoration = 'manual';

      document.body.appendChild(element);
      resetScrollPosition({
        url: new RelativeURL('/foo', '', '#bar'),
        state: null,
        navigationType,
      });
      document.body.removeChild(element);

      expect(scrollToSpy).not.toHaveBeenCalled();
      expect(scrollIntoViewSpy).toHaveBeenCalledOnce();
    },
  );

  it.each([['push'], ['reload'], ['replace'], ['traverse']] as const)(
    'scrolls to the top if there is not the element indicating hash',
    (navigationType) => {
      const scrollToSpy = vi.spyOn(window, 'scrollTo');

      history.scrollRestoration = 'manual';

      resetScrollPosition({
        url: new RelativeURL('/foo', '', '#bar'),
        state: null,
        navigationType,
      });

      expect(scrollToSpy).toHaveBeenCalled();
    },
  );

  it.each([['reload'], ['traverse']] as const)(
    'should do nothing if the navigation type is "reload" or "traverse" and `history.scrollrestoration` is "auto"',
    (navigationType) => {
      const scrollToSpy = vi.spyOn(window, 'scrollTo');

      history.scrollRestoration = 'auto';

      resetScrollPosition({
        url: new RelativeURL('/foo'),
        state: null,
        navigationType,
      });

      expect(scrollToSpy).not.toHaveBeenCalled();
    },
  );

  it('should do nothing if the navigation type is "initial"', () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo');

    resetScrollPosition({
      url: new RelativeURL('/foo'),
      state: null,
      navigationType: 'initial',
    });

    expect(scrollToSpy).not.toHaveBeenCalled();
  });
});
