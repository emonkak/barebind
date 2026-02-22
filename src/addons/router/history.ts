import { SharedContext } from '../../shared-context.js';
import type { RelativeURL } from './relative-url.js';

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

export interface NavigateOptions {
  replace?: boolean;
  state?: unknown;
}

export class HistoryContext extends SharedContext {
  readonly location: HistoryLocation;

  readonly navigator: HistoryNavigator;

  constructor(location: HistoryLocation, navigator: HistoryNavigator) {
    super();

    this.location = location;
    this.navigator = navigator;

    DEBUG: {
      Object.freeze(this);
    }
  }
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

export function trimHashMark(s: string): string {
  return s.startsWith('#') ? s.slice(1) : s;
}
