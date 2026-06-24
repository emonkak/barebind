import type { HostAdapter, VPortal, VTemplate } from '../core.js';
import { DOMBlock } from './block.js';
import { PortalPart } from './part.js';
import { DOMTemplate } from './template.js';

export class DOMAdapter implements HostAdapter {
  private readonly _document: Document;
  private readonly _identifier = generateUniqueIdentifier(8);
  private readonly _templateCache: WeakMap<readonly string[], DOMTemplate> =
    new WeakMap();

  constructor(document: Document = window.document) {
    this._document = document;
  }

  getIdentifier(): string {
    return this._identifier;
  }

  getTaskPriority(): TaskPriority {
    const currentEvent = this._document.defaultView?.event;
    if (currentEvent !== undefined) {
      return isContinuousEvent(currentEvent) ? 'user-visible' : 'user-blocking';
    }
    if (this._document.readyState !== 'complete') {
      return 'user-blocking';
    }
    return 'background';
  }

  renderPortal(element: VPortal): DOMBlock {
    const container = element.type;
    const document = container.ownerDocument;
    const fragment = document.createDocumentFragment();
    const part = new PortalPart(container);
    fragment.appendChild(document.createComment(''));
    return new DOMBlock(fragment, [part]);
  }

  renderTemplate(element: VTemplate): DOMBlock {
    const template = this._templateCache.getOrInsertComputed(element.type, () =>
      DOMTemplate.parse(
        element.type,
        element.children,
        element.props.mode,
        this._identifier,
        this._document,
      ),
    );
    return template.render();
  }

  requestCallback(
    callback: () => void | PromiseLike<void>,
    options?: SchedulerPostTaskOptions,
  ): Promise<void> {
    if (typeof window.scheduler?.postTask === 'function') {
      return scheduler.postTask(callback, options);
    } else {
      return new Promise((resolve) => {
        switch (options?.priority) {
          case 'user-blocking': {
            const channel = new MessageChannel();
            channel.port1.onmessage = resolve;
            channel.port2.postMessage(null);
            break;
          }
          case 'background': {
            if (typeof requestIdleCallback === 'function') {
              requestIdleCallback(resolve);
            } else {
              setTimeout(resolve, 1);
            }
            break;
          }
          default:
            setTimeout(resolve);
        }
      }).then(callback);
    }
  }

  requestCommit(callback: () => void): Promise<void> {
    return new Promise<void>((resolve) => {
      const frame = requestAnimationFrame(() => {
        clearTimeout(timer);
        resolve();
      });
      // Fallback: requestAnimationFrame never fires when the document
      // is not visible (e.g. hidden iframe, background tab throttling).
      const timer = setTimeout(() => {
        cancelAnimationFrame(frame);
        resolve();
      }, 100);
    }).then(callback);
  }

  startViewTransition(update: () => void, types: string[]): Promise<void> {
    return typeof this._document.startViewTransition === 'function'
      ? this._document.startViewTransition({ update, types }).updateCallbackDone
      : Promise.resolve().then(update);
  }

  yieldToMain(): Promise<void> {
    return typeof window.scheduler?.yield === 'function'
      ? scheduler.yield()
      : new Promise((resolve) => {
          setTimeout(resolve);
        });
  }
}

function generateUniqueIdentifier(length: number): string {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(length)),
    (byte, i) =>
      i === 0
        ? String.fromCharCode(0x61 + (byte % 26))
        : (byte % 36).toString(36),
  ).join('');
}

function isContinuousEvent(event: Event): boolean {
  switch (event.type) {
    case 'drag':
    case 'dragenter':
    case 'dragleave':
    case 'dragover':
    case 'mouseenter':
    case 'mouseleave':
    case 'mousemove':
    case 'mouseout':
    case 'mouseover':
    case 'pointerenter':
    case 'pointerleave':
    case 'pointermove':
    case 'pointerout':
    case 'pointerover':
    case 'scroll':
    case 'touchmove':
    case 'wheel':
      return true;
    default:
      return false;
  }
}
