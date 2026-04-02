/// <reference path="../../typings/upsert.d.ts" />

import type {
  Directive,
  DirectiveHandler,
  EffectPhases,
  HostAdapter,
  Lanes,
  PrimitiveHandler,
  Scope,
  Template,
} from '../core.js';
import { ConcurrentLane } from '../lane.js';
import { isRootScope } from '../scope.js';
import {
  type DOMPart,
  ensurePartType,
  PART_TYPE_ATTRIBUTE,
  PART_TYPE_CHILD_NODE,
  PART_TYPE_ELEMENT,
  PART_TYPE_EVENT,
  PART_TYPE_LIVE,
  PART_TYPE_PROPERTY,
  PART_TYPE_TEXT,
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

  getCommitPhases(): EffectPhases {
    return -1;
  }

  getDefaultLanes(): Lanes {
    return ConcurrentLane;
  }

  getIdentifier(): string {
    return this._identifier;
  }

  getTaskPriority(): TaskPriority {
    const { event } = window;
    return event !== undefined && !isContinuousEvent(event)
      ? 'user-blocking'
      : 'user-visible';
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
      case PART_TYPE_ATTRIBUTE:
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
      case PART_TYPE_CHILD_NODE:
      case PART_TYPE_TEXT:
        return new DOMNodeHandler();
      case PART_TYPE_ELEMENT:
        return new DOMElementHandler();
      case PART_TYPE_EVENT:
        return new DOMEventHandler();
      case PART_TYPE_LIVE:
        return new DOMLiveHandler();
      case PART_TYPE_PROPERTY:
        return new DOMPropertyHandler();
    }
  }

  resolveRepeat(
    directive: Directive.RepeatDirective<unknown>,
    part: DOMPart,
  ): DirectiveHandler<Iterable<unknown>, DOMPart, DOMRenderer> {
    ensurePartType(PART_TYPE_CHILD_NODE, directive, part);
    return new DOMRepeatHandler();
  }

  abstract requestRenderer(scope: Scope<DOMPart, DOMRenderer>): DOMRenderer;

  resolveTemplate(
    directive: Directive.TemplateDirective,
    part: DOMPart.ChildNodePart,
  ): DirectiveHandler<Template, DOMPart.ChildNodePart, DOMRenderer> {
    ensurePartType(PART_TYPE_CHILD_NODE, directive, part);
    const template = this._templateCache.getOrInsertComputed(
      directive.type,
      () =>
        DOMTemplate.parse(
          directive.type,
          directive.value.exprs,
          directive.value.mode,
          this._identifier,
        ),
    );
    return new DOMTemplateHandler(template);
  }

  startViewTransition(callback: () => PromiseLike<void> | void): Promise<void> {
    const document = this._container.ownerDocument;
    if (typeof document.startViewTransition === 'function') {
      return document.startViewTransition(callback).updateCallbackDone;
    } else {
      return Promise.resolve().then(callback);
    }
  }

  yieldToMain(): Promise<void> {
    if (typeof window.scheduler?.yield === 'function') {
      return scheduler.yield();
    } else {
      return new Promise((resolve) => {
        setTimeout(resolve);
      });
    }
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
