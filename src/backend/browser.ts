/// <reference path="../../typings/scheduler.d.ts" />

import {
  type CommitPhase,
  type Effect,
  type Part,
  PartType,
  type Primitive,
  type RequestCallbackOptions,
  type ScheduleOptions,
  type SlotType,
  type TemplateFactory,
} from '../internal.js';
import { AttributePrimitive } from '../primitive/attribute.js';
import { BlackholePrimitive } from '../primitive/blackhole.js';
import { ClassPrimitive } from '../primitive/class.js';
import { CommentPrimitive } from '../primitive/comment.js';
import { EventPrimitive } from '../primitive/event.js';
import { LivePrimitive } from '../primitive/live.js';
import { PropertyPrimitive } from '../primitive/property.js';
import { RefPrimitive } from '../primitive/ref.js';
import { SpreadPrimitive } from '../primitive/spread.js';
import { StylePrimitive } from '../primitive/style.js';
import { TextPrimitive } from '../primitive/text.js';
import type { Runtime, RuntimeBackend } from '../runtime.js';
import { LooseSlot } from '../slot/loose.js';
import { StrictSlot } from '../slot/strict.js';
import { OptimizedTemplateFactory } from '../template-factory.js';

export class BrowserBackend implements RuntimeBackend {
  private readonly _templateFactory: OptimizedTemplateFactory;

  constructor(document: Document = window.document) {
    this._templateFactory = new OptimizedTemplateFactory(document);
  }

  commitEffects(effects: Effect[], _phase: CommitPhase): void {
    for (let i = 0, l = effects.length; i < l; i++) {
      effects[i]!.commit();
    }
  }

  getCurrentPriority(): TaskPriority {
    const currentEvent = window.event;
    if (currentEvent !== undefined) {
      return isContinuousEvent(currentEvent) ? 'user-visible' : 'user-blocking';
    } else {
      return document.readyState === 'complete'
        ? 'background'
        : 'user-blocking';
    }
  }

  getTemplateFactory(): TemplateFactory {
    return this._templateFactory;
  }

  requestCallback(
    callback: () => Promise<void> | void,
    options?: RequestCallbackOptions,
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

  requestUpdate(
    callback: (flushUpdate: (runtime: Runtime) => void) => void,
    options: ScheduleOptions,
  ): Promise<void> {
    if (options.mode === 'sequential') {
      return Promise.resolve().then(() => callback(flushUpdate));
    } else {
      return this.requestCallback(() => callback(flushUpdate), options);
    }
  }

  resolvePrimitive(value: unknown, part: Part): Primitive<unknown> {
    switch (part.type) {
      case PartType.Attribute:
        if (part.name[0] === ':') {
          switch (part.name.slice(1).toLowerCase()) {
            case 'class':
              return ClassPrimitive;
            case 'ref':
              return RefPrimitive;
            case 'style':
              return StylePrimitive;
            default:
              return BlackholePrimitive;
          }
        }
        return AttributePrimitive;
      case PartType.ChildNode:
        return value != null ? CommentPrimitive : BlackholePrimitive;
      case PartType.Element:
        return SpreadPrimitive;
      case PartType.Event:
        return EventPrimitive;
      case PartType.Live:
        return LivePrimitive;
      case PartType.Property:
        return PropertyPrimitive;
      case PartType.Text:
        return TextPrimitive;
    }
  }

  resolveSlotType(_value: unknown, part: Part): SlotType {
    switch (part.type) {
      case PartType.ChildNode:
        return LooseSlot;
      default:
        return StrictSlot;
    }
  }

  startViewTransition(callback: () => Promise<void> | void): Promise<void> {
    if (typeof document.startViewTransition === 'function') {
      return document.startViewTransition(callback).ready;
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

function flushUpdate(runtime: Runtime): Promise<void> {
  return runtime.flushAsync();
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
