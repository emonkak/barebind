/// <reference path="../../typings/scheduler.d.ts" />

import type { Template, TemplateMode } from './coreTypes.js';
import { type Part, PartType } from './part.js';
import { AttributePrimitive } from './primitives/attribute.js';
import { ClassPrimitive } from './primitives/class.js';
import { EventPrimitive } from './primitives/event.js';
import { LivePrimitive } from './primitives/live.js';
import { NodePrimitive } from './primitives/node.js';
import type { Primitive } from './primitives/primitive.js';
import { PropertyPrimitive } from './primitives/property.js';
import { RefPrimitive } from './primitives/ref.js';
import { SpreadPrimitive } from './primitives/spread.js';
import { StylePrimitive } from './primitives/style.js';
import { EmptyTemplate } from './templates/emptyTemplate.js';
import { ChildTemplate, TextTemplate } from './templates/singleTemplate.js';
import { TaggedTemplate } from './templates/taggedTemplate.js';

export interface RenderHost {
  getPlaceholder(): string;
  getTaskPriority(): TaskPriority;
  createTemplate(
    strings: readonly string[],
    binds: unknown[],
    mode: TemplateMode,
  ): Template<readonly unknown[]>;
  requestCallback(
    callback: () => Promise<void> | void,
    options?: RequestCallbackOptions,
  ): Promise<void>;
  resolvePrimitive(part: Part): Primitive<unknown>;
  startViewTransition(callback: () => void | Promise<void>): Promise<void>;
  yieldToMain(): Promise<void>;
}

export interface RequestCallbackOptions {
  priority?: TaskPriority;
}

export interface BrowserHostOptions {
  placeholder?: string;
}

export class BrowserHost implements RenderHost {
  private readonly _placeholder: string;

  constructor({ placeholder = getRandomString(8) }: BrowserHostOptions = {}) {
    this._placeholder = placeholder;
  }

  createTemplate(
    strings: readonly string[],
    binds: unknown[],
    mode: TemplateMode,
  ): Template<readonly unknown[]> {
    if (binds.length === 0 && strings[0]!.trim() === '') {
      // Assumption: strings.length === 1
      return EmptyTemplate;
    }

    if (binds.length === 1) {
      // Assumption: strings.length === 2
      const beforeString = strings[0]!.trim();
      const afterString = strings[1]!.trim();

      if (beforeString === '' && afterString === '') {
        // The tag is nowhere, so it's text.
        return TextTemplate;
      }

      if (
        (beforeString === '<' || beforeString === '<!--') &&
        (afterString === '>' || afterString === '/>' || afterString === '-->')
      ) {
        // There is only one tag.
        return ChildTemplate;
      }
    }

    return TaggedTemplate.parse(strings, binds, this._placeholder, mode);
  }

  getPlaceholder(): string {
    return this._placeholder;
  }

  getTaskPriority(): TaskPriority {
    const currentEvent = window.event;
    if (currentEvent !== undefined) {
      return isContinuousEvent(currentEvent) ? 'user-visible' : 'user-blocking';
    } else {
      return 'user-visible';
    }
  }

  requestCallback(
    callback: () => Promise<void> | void,
    options?: RequestCallbackOptions,
  ): Promise<void> {
    if (typeof globalThis.scheduler?.postTask === 'function') {
      return scheduler.postTask(callback, options);
    } else {
      return new Promise((resolve) => {
        switch (options?.priority) {
          case 'user-blocking':
            const channel = new MessageChannel();
            channel.port1.onmessage = resolve;
            channel.port2.postMessage(null);
            break;
          case 'background':
            if (typeof requestIdleCallback === 'function') {
              requestIdleCallback(resolve);
            } else {
              setTimeout(resolve);
            }
            break;
          default:
            setTimeout(resolve);
        }
      }).then(() => callback());
    }
  }

  resolvePrimitive(part: Part): Primitive<unknown> {
    switch (part.type) {
      case PartType.Attribute:
        switch (part.name) {
          case ':class':
            return ClassPrimitive;
          case ':ref':
            return RefPrimitive;
          case ':style':
            return StylePrimitive;
          default:
            return AttributePrimitive;
        }
      case PartType.ChildNode:
      case PartType.Node:
        return NodePrimitive;
      case PartType.Element:
        return SpreadPrimitive;
      case PartType.Event:
        return EventPrimitive;
      case PartType.Live:
        return LivePrimitive;
      case PartType.Property:
        return PropertyPrimitive;
    }
  }

  startViewTransition(callback: () => void | Promise<void>): Promise<void> {
    if (typeof document.startViewTransition === 'function') {
      return document.startViewTransition(callback).finished;
    } else {
      return Promise.resolve().then(callback);
    }
  }

  yieldToMain(): Promise<void> {
    if (typeof globalThis.scheduler?.yield === 'function') {
      return scheduler.yield();
    } else {
      return new Promise((resolve) => setTimeout(resolve));
    }
  }
}

function getRandomString(length: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), (byte) =>
    (byte % 36).toString(36),
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

declare global {
  interface Window {
    /**
     * This property is marked as deprecated. But we use this to determine the
     * task priority. This definition suppresses "'event' is deprecated." warning
     * reported by VSCode.
     */
    readonly event: Event | undefined;
  }
}
