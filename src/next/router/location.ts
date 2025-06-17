import { type HookContext, type UserHook, userHookTag } from '../hook.js';
import type { RelativeURL } from './relativeURL.js';

export interface LocationState {
  readonly url: RelativeURL;
  readonly state: unknown;
  readonly navigationType: NavigationType;
}

export interface LocationNavigator {
  getCurrentURL(): RelativeURL;
  navigate(url: RelativeURL, options?: NavigateOptions): void;
}

export type NavigationType =
  | 'initial'
  | 'push'
  | 'reload'
  | 'replace'
  | 'traverse';

export interface NavigateOptions {
  replace?: boolean;
  state?: unknown;
}

export const CurrentLocation: UserHook<
  readonly [LocationState, LocationNavigator]
> = {
  [userHookTag](
    context: HookContext,
  ): readonly [LocationState, LocationNavigator] {
    const value = context.getContextValue(CurrentLocation);

    if (value == undefined) {
      throw new Error(
        'A context value for the current location does not exist, please ensure it is registered by context.use() with browserLocation or hashLocation.',
      );
    }

    return value as [LocationState, LocationNavigator];
  },
};

export function resetScrollPosition(locationState: LocationState): void {
  const { url, navigationType } = locationState;

  if (
    navigationType === 'initial' ||
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

/**
 * @internal
 */
export function anyModifiersArePressed(event: MouseEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

/**
 * @internal
 */
export function isInternalLink(element: Element): element is HTMLAnchorElement {
  return (
    element.tagName === 'A' &&
    element.hasAttribute('href') &&
    !element.hasAttribute('target') &&
    !element.hasAttribute('download') &&
    element.getAttribute('rel') !== 'external'
  );
}

/**
 * @internal
 */
export function trimHash(hash: string): string {
  return hash.startsWith('#') ? hash.slice(1) : hash;
}
