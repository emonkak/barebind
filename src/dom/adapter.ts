/// <reference path="../../typings/scheduler.d.ts" />
/// <reference path="../../typings/moveBefore.d.ts" />

import type { HostAdapter, RequestCallbackOptions } from '../adapter.js';
import type {
  CommitPhase,
  EffectQueue,
  Lanes,
  Primitive,
  Scope,
  TemplateMode,
} from '../core.js';
import { ConcurrentLane } from '../lane.js';
import { Blackhole, isIterable } from '../primitive.js';
import {
  type DOMPart,
  PART_TYPE_ATTRIBUTE,
  PART_TYPE_CHILD_NODE,
  PART_TYPE_ELEMENT,
  PART_TYPE_EVENT,
  PART_TYPE_LIVE,
  PART_TYPE_PROPERTY,
  PART_TYPE_TEXT,
} from './part.js';
import { DOMAttribute } from './primitive/attribute.js';
import { DOMClass } from './primitive/class.js';
import { DOMEvent } from './primitive/event.js';
import { DOMLive } from './primitive/live.js';
import { DOMNode } from './primitive/node.js';
import { DOMProperty } from './primitive/property.js';
import { DOMRef } from './primitive/ref.js';
import { DOMRepeat } from './primitive/repeat.js';
import { DOMSpread } from './primitive/spread.js';
import { DOMStyle } from './primitive/style.js';
import {
  ClientRenderer,
  type DOMRenderer,
  DOMTemplate,
  HydrationRenderer,
} from './template.js';

export interface DOMAdapterOptions {
  defaultLanes?: Lanes;
}

export abstract class DOMAdapter implements HostAdapter<DOMPart, DOMRenderer> {
  protected readonly _container: Element;

  protected readonly _defaultLanes: Lanes;

  constructor(
    container: Element,
    { defaultLanes = ConcurrentLane }: DOMAdapterOptions = {},
  ) {
    this._container = container;
    this._defaultLanes = defaultLanes;
  }

  get container(): Element {
    return this._container;
  }

  flushEffects(effects: EffectQueue, _phase: CommitPhase): void {
    effects.flush();
  }

  getDefaultLanes(): Lanes {
    return this._defaultLanes;
  }

  getUpdatePriority(): TaskPriority {
    const { event } = window;
    return event !== undefined && !isContinuousEvent(event)
      ? 'user-blocking'
      : 'user-visible';
  }

  abstract requestRenderer(scope: Scope): DOMRenderer;

  requestCallback<T>(
    callback: () => T | PromiseLike<T>,
    options?: RequestCallbackOptions,
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
    source: unknown,
    part: DOMPart,
  ): Primitive<unknown, DOMPart> {
    switch (part.type) {
      case PART_TYPE_ATTRIBUTE:
        if (part.name[0] === ':') {
          switch (part.name.slice(1).toLowerCase()) {
            case 'class':
              return DOMClass;
            case 'ref':
              return DOMRef;
            case 'style':
              return DOMStyle;
            default:
              return Blackhole;
          }
        }
        return DOMAttribute;
      case PART_TYPE_CHILD_NODE:
        return source == null
          ? Blackhole
          : typeof source !== 'string' && isIterable(source)
            ? DOMRepeat
            : DOMNode;
      case PART_TYPE_ELEMENT:
        return DOMSpread;
      case PART_TYPE_EVENT:
        return DOMEvent;
      case PART_TYPE_LIVE:
        return DOMLive;
      case PART_TYPE_PROPERTY:
        return DOMProperty;
      case PART_TYPE_TEXT:
        return DOMNode;
    }
  }

  resolveTemplate(
    strings: readonly string[],
    exprs: readonly unknown[],
    mode: TemplateMode,
    placeholder: string,
  ): DOMTemplate {
    return DOMTemplate.parse(
      strings,
      exprs,
      mode,
      placeholder,
      this._container.ownerDocument,
    );
  }

  startViewTransition(callback: () => Promise<void> | void): Promise<void> {
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
  requestRenderer(_scope: Scope): DOMRenderer {
    return new ClientRenderer(this._container);
  }
}

export class HydrationAdapter extends DOMAdapter {
  requestRenderer(scope: Scope): DOMRenderer {
    return scope.isRoot()
      ? new HydrationRenderer(this._container)
      : new ClientRenderer(this._container);
  }
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
