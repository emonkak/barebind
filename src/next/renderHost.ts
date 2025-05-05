/// <reference path="../../typings/scheduler.d.ts" />

import type { Template, TemplateMode } from './coreTypes.js';
import { type Part, PartType } from './part.js';
import { AttributePrimitive } from './primitives/attribute.js';
import { ClassPrimitive } from './primitives/class.js';
import { EventPrimitive } from './primitives/event.js';
import { NodePrimitive } from './primitives/node.js';
import type { Primitive } from './primitives/primitive.js';
import { PropertyPrimitive } from './primitives/property.js';
import { RefPrimitive } from './primitives/ref.js';
import { SpreadPrimitive } from './primitives/spread.js';
import { StylePrimitive } from './primitives/style.js';

export interface RenderHost {
  getTaskPriority(): TaskPriority;
  getHostName(): string;
  createTemplate<TBinds extends readonly any[]>(
    strings: readonly string[],
    binds: TBinds,
    mode: TemplateMode,
  ): Template<TBinds>;
  requestCallback(
    callback: () => void,
    options?: RequestCallbackOptions,
  ): Promise<void>;
  resolvePrimitive(part: Part): Primitive<unknown>;
  startViewTransition(callback: () => void | Promise<void>): Promise<void>;
}

export interface RequestCallbackOptions {
  priority?: TaskPriority;
}

export interface BrowserHostOptions {
  hostName?: string;
}

export class BrowserHost implements RenderHost {
  private readonly _hostName: string;

  constructor({ hostName = getRandomString(8) }: BrowserHostOptions = {}) {
    this._hostName = hostName;
  }

  createTemplate<TBinds extends readonly any[]>(
    _strings: readonly string[],
    _binds: TBinds,
    _mode: TemplateMode,
  ): Template<TBinds> {
    throw new Error('Method not implemented.');
  }

  getHostName(): string {
    return this._hostName;
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
    callback: () => void,
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
