/// <reference path="../../typings/scheduler.d.ts" />

import {
  type CommitPhase,
  type Effect,
  type Layout,
  type Part,
  PartType,
  type Primitive,
  type RequestCallbackOptions,
  type Template,
  type TemplateMode,
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
import { LooseLayout } from '../slot/loose.js';
import { StrictLayout } from '../slot/strict.js';
import { TaggedTemplate } from '../template/tagged.js';

export class BrowserBackend implements RuntimeBackend {
  commitEffects(effects: Effect[], _phase: CommitPhase): void {
    for (let i = 0, l = effects.length; i < l; i++) {
      effects[i]!.commit();
    }
  }

  flushUpdate(runtime: Runtime): void {
    runtime.flushAsync();
  }

  getTaskPriority(): TaskPriority {
    const currentEvent = window.event;
    if (currentEvent !== undefined) {
      return isContinuousEvent(currentEvent) ? 'user-visible' : 'user-blocking';
    } else {
      return document.readyState === 'complete'
        ? 'background'
        : 'user-blocking';
    }
  }

  parseTemplate(
    strings: readonly string[],
    binds: readonly unknown[],
    placeholder: string,
    mode: TemplateMode,
  ): Template<readonly unknown[]> {
    return TaggedTemplate.parse(strings, binds, placeholder, mode, document);
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

  resolveLayout(_value: unknown, part: Part): Layout {
    switch (part.type) {
      case PartType.ChildNode:
        return LooseLayout.instance;
      default:
        return StrictLayout.instance;
    }
  }

  resolvePrimitive(value: unknown, part: Part): Primitive<unknown> {
    switch (part.type) {
      case PartType.Attribute:
        if (part.name[0] === ':') {
          switch (part.name.slice(1).toLowerCase()) {
            case 'class':
              return ClassPrimitive.instance;
            case 'ref':
              return RefPrimitive.instance;
            case 'style':
              return StylePrimitive.instance;
            default:
              return BlackholePrimitive.instance;
          }
        }
        return AttributePrimitive.instance;
      case PartType.ChildNode:
        return value != null
          ? CommentPrimitive.instance
          : BlackholePrimitive.instance;
      case PartType.Element:
        return SpreadPrimitive.instance;
      case PartType.Event:
        return EventPrimitive.instance;
      case PartType.Live:
        return LivePrimitive.instance;
      case PartType.Property:
        return PropertyPrimitive.instance;
      case PartType.Text:
        return TextPrimitive.instance;
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
