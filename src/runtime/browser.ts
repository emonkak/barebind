/// <reference path="../../typings/scheduler.d.ts" />

import {
  type CommitPhase,
  type EffectQueue,
  type Layout,
  type Part,
  PartType,
  type Primitive,
  type RequestCallbackOptions,
  type Template,
  type TemplateMode,
} from '../internal.js';
import { LooseLayout } from '../layout/loose.js';
import { StrictLayout } from '../layout/strict.js';
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
import { TaggedTemplate } from '../template/tagged.js';

export class BrowserBackend implements RuntimeBackend {
  flushEffects(effects: EffectQueue, _phase: CommitPhase): void {
    effects.flush();
  }

  flushUpdate(runtime: Runtime): void {
    runtime.flushAsync();
  }

  getTaskPriority(): TaskPriority {
    const { event } = window;
    if (event !== undefined) {
      return isContinuousEvent(event) ? 'user-visible' : 'user-blocking';
    } else {
      return document.readyState === 'complete'
        ? 'background'
        : 'user-blocking';
    }
  }

  parseTemplate(
    strings: readonly string[],
    binds: readonly unknown[],
    markerToken: string,
    mode: TemplateMode,
  ): Template<readonly unknown[]> {
    return TaggedTemplate.parse(strings, binds, markerToken, mode, document);
  }

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

  resolveLayout(_source: unknown, part: Part): Layout {
    return part.type === PartType.ChildNode ? LooseLayout : StrictLayout;
  }

  resolvePrimitive(source: unknown, part: Part): Primitive<unknown> {
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
        return source != null ? CommentPrimitive : BlackholePrimitive;
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
