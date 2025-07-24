import { $customHook, type CustomHook } from '../../core.js';
import type { RelativeURL } from './url.js';

export interface LocationSnapshot {
  readonly url: RelativeURL;
  readonly state: unknown;
  readonly navigationType: NavigationType | null;
}

export interface LocationNavigator {
  getCurrentURL(): RelativeURL;
  navigate(url: string | RelativeURL, options?: NavigateOptions): void;
}

export interface NavigateOptions {
  replace?: boolean;
  state?: unknown;
}

export const CurrentLocation: CustomHook<
  readonly [LocationSnapshot, LocationNavigator]
> = {
  [$customHook](context) {
    const value = context.getContextValue(CurrentLocation);

    if (value === undefined) {
      throw new Error(
        'A context value for the current location does not exist, please ensure it is registered by context.use() with browserLocation or hashLocation.',
      );
    }

    return value as [LocationSnapshot, LocationNavigator];
  },
};

export function anyModifiersArePressed(event: MouseEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

export function isInternalLink(element: Element): element is HTMLAnchorElement {
  return (
    element.tagName === 'A' &&
    element.hasAttribute('href') &&
    !element.hasAttribute('target') &&
    !element.hasAttribute('download') &&
    element.getAttribute('rel') !== 'external'
  );
}

export function trimHash(hash: string): string {
  return hash.startsWith('#') ? hash.slice(1) : hash;
}
