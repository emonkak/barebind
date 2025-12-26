import type { RenderContext } from '../../internal.js';
import type { RelativeURL } from './relative-url.js';

export interface HistoryHandle {
  location: HistoryLocation;
  navigator: HistoryNavigator;
}

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

export function CurrentHistory(context: RenderContext): HistoryHandle {
  const value = context.getSharedContext(CurrentHistory);

  if (value === undefined) {
    throw new Error(
      'A context value for the hisotry handle does not exist, please ensure it is registered by context.use() with BrowserLocation or HashLocation.',
    );
  }

  return value as HistoryHandle;
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
