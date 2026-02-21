import type { RenderContext } from '../../internal.js';
import type { RelativeURL } from './relative-url.js';

export const $HistoryContext = Symbol('$HistoryContext');

export interface HisotryContext {
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

export interface NavigateOptions {
  replace?: boolean;
  state?: unknown;
}

export function HistoryContext(context: RenderContext): HisotryContext {
  const historyContext = context.getSharedContext($HistoryContext);

  if (historyContext === undefined) {
    throw new Error(
      'No history context found. Make sure to register BrowserHistory or HashHistory with context.use() before using HisotryContext.',
    );
  }

  return historyContext as HisotryContext;
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
