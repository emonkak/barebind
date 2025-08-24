import type { HookContext } from '../../internal.js';
import type { RelativeURL } from './url.js';

export interface HistoryLocation {
  readonly url: RelativeURL;
  readonly state: unknown;
  readonly navigationType: NavigationType | null;
}

export interface HistoryNavigator {
  getCurrentURL(): RelativeURL;
  isTransitionPending(): boolean;
  navigate(url: string | RelativeURL, options?: NavigateOptions): void;
  waitForTransition(): Promise<number>;
}

export type NavigationListener = (
  newLocation: HistoryLocation,
  oldLocation: HistoryLocation,
) => void;

export interface NavigateOptions {
  replace?: boolean;
  state?: unknown;
}

export function CurrentHistory(
  context: HookContext,
): readonly [HistoryLocation, HistoryNavigator] {
  const value = context.getContextValue(CurrentHistory);

  if (value === undefined) {
    throw new Error(
      'A context value for the current location does not exist, please ensure it is registered by context.use() with browserLocation or hashLocation.',
    );
  }

  return value as [HistoryLocation, HistoryNavigator];
}

export function anyModifiersArePressed(event: MouseEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

export function isInternalLink(element: Element): element is HTMLAnchorElement {
  return (
    element.localName === 'a' &&
    element.hasAttribute('href') &&
    !element.hasAttribute('target') &&
    !element.hasAttribute('download') &&
    element.getAttribute('rel') !== 'external'
  );
}

export function truncateHashMark(hash: string): string {
  return hash.startsWith('#') ? hash.slice(1) : hash;
}
