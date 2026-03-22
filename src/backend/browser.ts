/// <reference path="../../typings/scheduler.d.ts" />

import {
  type Backend,
  type CommitPhase,
  type DirectiveType,
  type EffectQueue,
  type Lanes,
  PART_TYPE_ATTRIBUTE,
  PART_TYPE_CHILD_NODE,
  PART_TYPE_ELEMENT,
  PART_TYPE_EVENT,
  PART_TYPE_LIVE,
  PART_TYPE_PROPERTY,
  PART_TYPE_TEXT,
  type Part,
  type Primitive,
  type RequestCallbackOptions,
  type TemplateMode,
} from '../core.js';
import { ConcurrentLane } from '../lane.js';
import { AttributeType } from '../primitive/attribute.js';
import { BlackholeType } from '../primitive/blackhole.js';
import { ClassType } from '../primitive/class.js';
import { CommentType } from '../primitive/comment.js';
import { EventType } from '../primitive/event.js';
import { LiveType } from '../primitive/live.js';
import { PropertyType } from '../primitive/property.js';
import { RefType } from '../primitive/ref.js';
import { SpreadType } from '../primitive/spread.js';
import { StyleType } from '../primitive/style.js';
import { TextType } from '../primitive/text.js';
import { TaggedTemplate } from '../template/tagged.js';

export class BrowserBackend implements Backend {
  flushEffects(effects: EffectQueue, _phase: CommitPhase): void {
    effects.flush();
  }

  getDefaultLanes(): Lanes {
    return ConcurrentLane;
  }

  getUpdatePriority(): TaskPriority {
    const { event } = window;
    return event !== undefined && !isContinuousEvent(event)
      ? 'user-blocking'
      : 'user-visible';
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

  resolvePrimitive(source: unknown, part: Part): Primitive<unknown> {
    switch (part.type) {
      case PART_TYPE_ATTRIBUTE:
        if (part.name[0] === ':') {
          switch (part.name.slice(1).toLowerCase()) {
            case 'class':
              return ClassType;
            case 'ref':
              return RefType;
            case 'style':
              return StyleType;
            default:
              return BlackholeType;
          }
        }
        return AttributeType;
      case PART_TYPE_CHILD_NODE:
        return source != null ? CommentType : BlackholeType;
      case PART_TYPE_ELEMENT:
        return SpreadType;
      case PART_TYPE_EVENT:
        return EventType;
      case PART_TYPE_LIVE:
        return LiveType;
      case PART_TYPE_PROPERTY:
        return PropertyType;
      case PART_TYPE_TEXT:
        return TextType;
    }
  }

  resolveTemplate(
    strings: readonly string[],
    values: readonly unknown[],
    markerIdentifier: string,
    mode: TemplateMode,
  ): DirectiveType<readonly unknown[]> {
    return TaggedTemplate.parse(
      strings,
      values,
      markerIdentifier,
      mode,
      document,
    );
  }

  startViewTransition(callback: () => Promise<void> | void): Promise<void> {
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
