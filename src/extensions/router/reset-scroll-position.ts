import { type LocationState, trimHash } from './location.js';

export function resetScrollPosition(locationState: LocationState): void {
  const { url, navigationType } = locationState;

  if (
    navigationType === null ||
    ((navigationType === 'reload' || navigationType === 'traverse') &&
      history.scrollRestoration === 'auto')
  ) {
    return;
  }

  if (url.hash !== '') {
    const id = trimHash(url.hash);
    const element = document.getElementById(id);

    if (element !== null) {
      element.scrollIntoView();
      return;
    }
  }

  scrollTo(0, 0);
}
