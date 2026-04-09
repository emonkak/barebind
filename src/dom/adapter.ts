/// <reference path="../../typings/upsert.d.ts" />

import type {
  Directive,
  DirectiveHandler,
  HostAdapter,
  Lanes,
  PrimitiveHandler,
  Scope,
  Template,
} from '../core.js';
import { isRootScope } from '../scope.js';
import { ensurePartType } from './error.js';
import {
  AttributeType,
  ChildNodeType,
  type DOMPart,
  ElementType,
  EventType,
  LiveType,
  PropertyType,
  TextType,
} from './part.js';
import {
  DOMAttributeHandler,
  DOMClassHandler,
  DOMElementHandler,
  DOMEventHandler,
  DOMLiveHandler,
  DOMNodeHandler,
  DOMPropertyHandler,
  DOMRefHandler,
  DOMStyleHandler,
} from './primitive.js';
import {
  ClientRenderer,
  type DOMRenderer,
  HydrationRenderer,
} from './renderer.js';
import { DOMRepeatHandler } from './repeat.js';
import { DOMTemplate, DOMTemplateHandler } from './template.js';

export interface DOMAdapterOptions {
  identifier?: string;
}

export abstract class DOMAdapter implements HostAdapter<DOMPart, DOMRenderer> {
  protected readonly _container: Element;

  private readonly _identifier: string;

  private readonly _templateCache: WeakMap<readonly string[], DOMTemplate> =
    new WeakMap();

  constructor(
    container: Element,
    { identifier = generateUniqueIdentifier(8) }: DOMAdapterOptions = {},
  ) {
    this._container = container;
    this._identifier = identifier;
  }

  get container(): Element {
    return this._container;
  }

  getDefaultLanes(): Lanes {
    return 0;
  }

  getIdentifier(): string {
    return this._identifier;
  }

  getTaskPriority(): TaskPriority {
    return window.event !== undefined
      ? isContinuousEvent(window.event)
        ? 'user-visible'
        : 'user-blocking'
      : 'background';
  }

  requestCallback<T>(
    callback: () => T | PromiseLike<T>,
    options?: SchedulerPostTaskOptions,
  ): Promise<T> {
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

  resolvePrimitive(
    _directive: Directive.PrimitiveDirective<unknown>,
    part: DOMPart,
  ): PrimitiveHandler<unknown, DOMPart, DOMRenderer> {
    switch (part.type) {
      case AttributeType:
        switch (part.name) {
          case ':class':
            return new DOMClassHandler();
          case ':ref':
            return new DOMRefHandler();
          case ':style':
            return new DOMStyleHandler();
          default:
            return new DOMAttributeHandler();
        }
      case ChildNodeType:
      case TextType:
        return new DOMNodeHandler();
      case ElementType:
        return new DOMElementHandler();
      case EventType:
        return new DOMEventHandler();
      case LiveType:
        return new DOMLiveHandler();
      case PropertyType:
        return new DOMPropertyHandler();
    }
  }

  resolveRepeat(
    directive: Directive.RepeatDirective<unknown>,
    part: DOMPart,
  ): DirectiveHandler<Iterable<unknown>, DOMPart, DOMRenderer> {
    ensurePartType(ChildNodeType, directive, part);
    return new DOMRepeatHandler();
  }

  abstract requestRenderer(scope: Scope<DOMPart, DOMRenderer>): DOMRenderer;

  resolveTemplate(
    directive: Directive.TemplateDirective,
    part: DOMPart.ChildNodePart,
  ): DirectiveHandler<Template, DOMPart.ChildNodePart, DOMRenderer> {
    ensurePartType(ChildNodeType, directive, part);
    const template = this._templateCache.getOrInsertComputed(
      directive.type,
      () =>
        DOMTemplate.parse(
          directive.type,
          directive.value.exprs,
          directive.value.mode,
          this._identifier,
          this._container.ownerDocument,
        ),
    );
    return new DOMTemplateHandler(template);
  }

  startViewTransition(callback: () => PromiseLike<void> | void): Promise<void> {
    const document = this._container.ownerDocument;
    return typeof document.startViewTransition === 'function'
      ? document.startViewTransition(callback).updateCallbackDone
      : Promise.resolve().then(callback);
  }

  yieldToMain(): Promise<void> {
    return typeof window.scheduler?.yield === 'function'
      ? scheduler.yield()
      : new Promise((resolve) => {
          setTimeout(resolve);
        });
  }
}

export class ClientAdapter extends DOMAdapter {
  requestRenderer(_scope: Scope<DOMPart, DOMRenderer>): DOMRenderer {
    return new ClientRenderer(this._container);
  }
}

export class HydrationAdapter extends DOMAdapter {
  requestRenderer(scope: Scope<DOMPart, DOMRenderer>): DOMRenderer {
    return isRootScope(scope) &&
      !this._container.contains(scope.owner.part.node)
      ? new HydrationRenderer(this._container)
      : new ClientRenderer(this._container);
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
  switch (event.type as keyof DocumentEventMap) {
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
