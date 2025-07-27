import { type HisotryLocation, trimHash } from './history.js';

export function resetScrollPosition(location: HisotryLocation): void {
  const { url, navigationType } = location;

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
