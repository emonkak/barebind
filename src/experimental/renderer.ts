// import type { Part } from './part.js';
//
// const CSS_UPPERCASE_LETTER_PATTERN = /[A-Z]/g;
// const CSS_VENDOR_PREFIX_PATTERN = /^(webkit|moz|ms|o)(?=[A-Z])/;
//
// const CLASS_TOKEN_SEPARATOR_PATTERN = /\s+/;
//
// export type ClassMap = {
//   readonly [key: string]: boolean;
// };
//
// export type StyleMap = {
//   readonly [key: string]: string;
// };
//
// export class SetAttribute implements Directive<Part.AttributePart> {
//   value: unknown;
//
//   constructor(value: unknown) {
//     this.value = value;
//   }
//
//   mount(part: Part.AttributePart): void {
//     if (this.value == null) {
//       part.node.removeAttribute(part.name);
//     } else if (typeof this.value === 'boolean') {
//       part.node.toggleAttribute(part.name, this.value);
//     } else {
//       part.node.setAttribute(part.name, this.value?.toString?.() ?? '');
//     }
//   }
//
//   unmount(part: Part.AttributePart): void {
//     part.node.removeAttribute(part.name);
//   }
// }
//
// export class SetStyle implements Directive<Part.AttributePart> {
//   oldProps: StyleMap;
//   newProps: StyleMap;
//
//   constructor(oldProps: StyleMap, newProps: StyleMap) {
//     this.oldProps = oldProps;
//     this.newProps = newProps;
//   }
//
//   mount(part: Part.AttributePart): void {
//     updateStyle((part.node as HTMLElement).style, this.oldProps, this.newProps);
//   }
//
//   unmount(part: Part.AttributePart): void {
//     updateStyle((part.node as HTMLElement).style, this.newProps, {});
//   }
// }
//
// export class SetClass implements Directive<Part.AttributePart> {
//   oldTokens: ClassMap;
//   newTokens: ClassMap;
//
//   constructor(oldTokens: ClassMap) {
//     this.oldTokens = oldTokens;
//     this.newTokens = oldTokens;
//   }
//
//   mount(part: Part.AttributePart): void {
//     updateClass(part.node.classList, this.oldTokens, this.newTokens);
//   }
//
//   unmount(part: Part.AttributePart): void {
//     updateClass(part.node.classList, this.newTokens, {});
//   }
// }
//
// export class SetEventListener implements Directive<Part.EventPart> {
//   listener: EventListenerOrEventListenerObject & AddEventListenerOptions;
//
//   constructor(listener: EventListenerObject) {
//     this.listener = listener;
//   }
//
//   mount(part: Part.EventPart): void {
//     part.node.addEventListener(part.name, this.listener, this.listener);
//   }
//
//   unmount(part: Part.EventPart): void {
//     part.node.removeEventListener(part.name, this.listener, this.listener);
//   }
// }
//
// export class PrimitiveDirective {
//   needsRender(value: unknown, part: Part): boolean {
//     return !Object.is(value, part.currentValue);
//   }
//
//   render(value: unknown, part: Part): unknown {
//     switch (part.type) {
//       case PartType.Attribute:
//         switch (part.name) {
//         }
//         if (!isObject(value)) {
//           throw new Error('Class values must be object.');
//         }
//         break;
//       case EventPart:
//         if (!isEventListenerOrNullish(value)) {
//           throw new Error(
//             'Event values must be EventListener, EventListenerObject, null or undefined.',
//           );
//         }
//         break;
//       case StylePart:
//         if (!isObject(value)) {
//           throw new Error('Style values must be object.');
//         }
//         break;
//     }
//     return value;
//   }
// }
//
// function getEventListenerOptions(
//   listener: EventListenerOrEventListenerObject,
// ): unknown[] {
//   const { capture, once, passive, signal } =
//     listener as AddEventListenerOptions;
//   return [capture, once, passive, signal];
// }
//
// function isEventListenerOrNullish(
//   value: any,
// ): value is EventListenerOrEventListenerObject {
//   return (
//     value == null ||
//     typeof value === 'function' ||
//     typeof value.handleEvent === 'function'
//   );
// }
//
// function isObject(value: unknown): value is object {
//   return typeof value === 'object' && value !== null;
// }
//
// /**
//  * Convert style property names expressed in lowerCamelCase to CSS style
//  * propertes in kebab-case.
//  *
//  * @example
//  * toCSSProperty('webkitFontSmoothing'); // => '-webkit-font-smoothing'
//  * @example
//  * toCSSProperty('paddingBlock'); // => 'padding-block'
//  * @example
//  * // returns the given property as is.
//  * toCSSProperty('--my-css-property'); // => '--my-css-property'
//  * toCSSProperty('padding-block'); // => 'padding-block'
//  */
// function toCSSPropertyName(key: string): string {
//   return key
//     .replace(CSS_VENDOR_PREFIX_PATTERN, '-$1')
//     .replace(CSS_UPPERCASE_LETTER_PATTERN, (c) => '-' + c.toLowerCase());
// }
//
// function toggleClass(
//   classList: DOMTokenList,
//   key: string,
//   enabled: boolean,
// ): void {
//   for (const token of key.trim().split(CLASS_TOKEN_SEPARATOR_PATTERN)) {
//     if (token !== '') {
//       classList.toggle(token, enabled);
//     }
//   }
// }
//
// function updateClass(
//   classList: DOMTokenList,
//   oldTokens: ClassMap,
//   newTokens: ClassMap,
// ): void {
//   for (const key of Object.keys(oldTokens)) {
//     if (!Object.hasOwn(newTokens, key)) {
//       toggleClass(classList, key, false);
//     }
//   }
//
//   for (const key of Object.keys(newTokens)) {
//     toggleClass(classList, key, newTokens[key]!);
//   }
// }
//
// function updateStyle(
//   style: CSSStyleDeclaration,
//   oldProps: StyleMap,
//   newProps: StyleMap,
// ): void {
//   for (const key of Object.keys(oldProps)) {
//     if (
//       oldProps[key] != null &&
//       (!Object.hasOwn(newProps, key) || newProps[key] == null)
//     ) {
//       const name = toCSSPropertyName(key);
//       style.removeProperty(name);
//     }
//   }
//
//   for (const key of Object.keys(newProps)) {
//     const value = newProps[key];
//     if (value != null) {
//       const name = toCSSPropertyName(key);
//       style.setProperty(name, value);
//     }
//   }
// }
