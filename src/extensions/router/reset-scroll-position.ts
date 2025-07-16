import { type LocationSnapshot, trimHash } from './location.js';

export function resetScrollPosition(locationSnapshot: LocationSnapshot): void {
  const { url, navigationType } = locationSnapshot;

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
