// import {
//   createAttributePart,
//   createChildNodePart,
//   createElementPart,
//   createEventPart,
//   createLivePart,
//   createPropertyPart,
//   createTextPart,
//   type Part,
//   PartType,
// } from './part.js';
// import type { TemplateMode } from './types.js';
//
// const PLACEHOLDER_PATTERN = /^[0-9a-z_-]+$/;
//
// const LEADING_NEWLINE_PATTERN = /^\s*\n/;
// const TRAILING_NEWLINE_PATTERN = /\n\s*$/;
//
// // https://html.spec.whatwg.org/multipage/syntax.html#attributes-2
// const ATTRIBUTE_NAME_CLASS = String.raw`[^ "'>/=\p{Control}\p{Noncharacter_Code_Point}]`;
// // https://infra.spec.whatwg.org/#ascii-whitespace
// const WHITESPACE_CLASS = String.raw`[\t\n\f\r ]`;
// const QUOTE_CLASS = `["']`;
// const ATTRIBUTE_NAME_PATTERN = new RegExp(
//   `${ATTRIBUTE_NAME_CLASS}+(?=${WHITESPACE_CLASS}*=${WHITESPACE_CLASS}*${QUOTE_CLASS}?$)`,
//   'u',
// );
//
// export type Hole =
//   | Hole.AttributeHole
//   | Hole.ChildNodeHole
//   | Hole.ElementHole
//   | Hole.EventHole
//   | Hole.LiveHole
//   | Hole.PropertyHole
//   | Hole.TextHole;
//
// export namespace Hole {
//   export interface AttributeHole {
//     type: typeof PartType.Attribute;
//     index: number;
//     name: string;
//   }
//
//   export interface ChildNodeHole {
//     type: typeof PartType.ChildNode;
//     index: number;
//   }
//
//   export interface ElementHole {
//     type: typeof PartType.Element;
//     index: number;
//   }
//
//   export interface EventHole {
//     type: typeof PartType.Event;
//     index: number;
//     name: string;
//   }
//
//   export interface LiveHole {
//     type: typeof PartType.Live;
//     index: number;
//     name: string;
//   }
//
//   export interface PropertyHole {
//     type: typeof PartType.Property;
//     index: number;
//     name: string;
//   }
//
//   export interface TextHole {
//     type: typeof PartType.Text;
//     index: number;
//     leadingSpan: number;
//     trailingSpan: number;
//   }
// }
//
// export class DOMTemplate {
//   readonly element: HTMLTemplateElement;
//   readonly holes: Hole[];
//   readonly mode: TemplateMode;
//
//   static parse(
//     strings: readonly string[],
//     exprs: readonly unknown[],
//     mode: TemplateMode,
//     placeholder: string,
//     document: Document,
//   ) {
//     const element = document.createElement('template');
//     const marker = createMarker(placeholder);
//     const html = stripWhitespaces(strings.join(marker));
//
//     if (mode === 'html') {
//       element.setHTMLUnsafe(html);
//     } else {
//       element.setHTMLUnsafe(`<${mode}>${html}</${mode}>`);
//       element.content.replaceChildren(
//         ...element.content.firstChild!.childNodes,
//       );
//     }
//
//     const holes = parseChildren(strings, exprs, marker, element);
//
//     return new Template(element, holes, mode);
//   }
//
//   constructor(element: HTMLTemplateElement, holes: Hole[], mode: TemplateMode) {
//     this.element = element;
//     this.holes = holes;
//     this.mode = mode;
//   }
//
//   render(exprs: unknown[]): Block {
//     const root = this.element.ownerDocument.importNode(
//       this.element.content,
//       true,
//     );
//     const holes = this.holes;
//     const parts: Part[] = new Array(holes.length);
//     const childNodes = Array.from(root.childNodes);
//
//     if (holes.length > 0) {
//       const templateWalker = createTreeWalker(root);
//       let nodeIndex = 0;
//
//       for (let i = 0, l = holes.length; i < l; i++) {
//         const hole = holes[i]!;
//
//         for (; nodeIndex <= hole.index; nodeIndex++) {
//           if (templateWalker.nextNode() === null) {
//             throw new Error(
//               'There is no node that the hole indicates. The template may have been modified.',
//             );
//           }
//         }
//
//         const currentNode = templateWalker.currentNode;
//         let currentPart: Part;
//
//         switch (hole.type) {
//           case PartType.Attribute:
//             currentPart = createAttributePart(
//               currentNode as Element,
//               hole.name,
//             );
//             break;
//           case PartType.Event:
//             currentPart = createEventPart(currentNode as Element, hole.name);
//             break;
//           case PartType.ChildNode:
//             currentPart = createChildNodePart(currentNode as Comment);
//             break;
//           case PartType.Element:
//             currentPart = createElementPart(currentNode as Element);
//             break;
//           case PartType.Live:
//             currentPart = createLivePart(currentNode as Element, hole.name);
//             break;
//           case PartType.Property:
//             currentPart = createPropertyPart(currentNode as Element, hole.name);
//             break;
//           case PartType.Text:
//             currentPart = splitTextPart(templateWalker, hole);
//             break;
//         }
//
//         parts[i] = currentPart;
//       }
//     }
//
//     return new Block(childNodes, parts);
//   }
// }
//
// export function createTreeWalker(
//   container: DocumentFragment | Element,
// ): TreeWalker {
//   return container.ownerDocument.createTreeWalker(
//     container,
//     NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT,
//   );
// }
//
// function createMarker(placeholder: string): string {
//   if (!PLACEHOLDER_PATTERN.test(placeholder)) {
//     throw new Error(
//       `Placeholders must match pattern ${PLACEHOLDER_PATTERN.source}, but got "${placeholder}".`,
//     );
//   }
//   return '??' + placeholder + '??';
// }
//
// function getRawAttributeName(s: string): string | undefined {
//   return s.match(ATTRIBUTE_NAME_PATTERN)?.[0];
// }
//
// function parseAttribtues(
//   element: Element,
//   strings: readonly string[],
//   marker: string,
//   holes: Hole[],
//   index: number,
// ): void {
//   for (const attribute of Array.from(element.attributes)) {
//     let hole: Hole;
//
//     if (attribute.name === marker && attribute.value === '') {
//       hole = {
//         type: PartType.Element,
//         index,
//       };
//     } else if (attribute.value === marker) {
//       const rawName = getRawAttributeName(strings[holes.length]!);
//
//       DEBUG: {
//         if (rawName?.toLowerCase() !== attribute.name) {
//           throw new Error(
//             `The attribute name must be "${attribute.name}", but got "${rawName}". There are unclosed tags or duplicate attributes.`,
//           );
//         }
//       }
//
//       switch (rawName[0]) {
//         case '@':
//           hole = {
//             type: PartType.Event,
//             index,
//             name: rawName.slice(1),
//           };
//           break;
//         case '$':
//           hole = {
//             type: PartType.Live,
//             index,
//             name: rawName.slice(1),
//           };
//           break;
//         case '.':
//           hole = {
//             type: PartType.Property,
//             index,
//             name: rawName.slice(1),
//           };
//           break;
//         default:
//           hole = {
//             type: PartType.Attribute,
//             index,
//             name: rawName,
//           };
//           break;
//       }
//     } else {
//       DEBUG: {
//         if (attribute.name.includes(marker)) {
//           throw new Error('Expressions are not allowed as an attribute name.');
//         }
//
//         if (attribute.value.includes(marker)) {
//           throw new Error(
//             'Expressions inside an attribute must make up the entire attribute value.',
//           );
//         }
//       }
//       continue;
//     }
//
//     holes.push(hole);
//     element.removeAttribute(attribute.name);
//   }
// }
//
// function parseChildren(
//   strings: readonly string[],
//   exprs: readonly unknown[],
//   marker: string,
//   template: HTMLTemplateElement,
// ): Hole[] {
//   const sourceTree = createTreeWalker(template.content);
//   const holes: Hole[] = [];
//   let nextNode = sourceTree.nextNode();
//   let index = 0;
//
//   while (nextNode !== null) {
//     const currentNode = nextNode;
//     switch (currentNode.nodeType) {
//       case Node.ELEMENT_NODE: {
//         DEBUG: {
//           if ((currentNode as Element).localName.includes(marker)) {
//             new Error('Expressions are not allowed as a tag name.');
//           }
//         }
//         if ((currentNode as Element).hasAttributes()) {
//           parseAttribtues(
//             currentNode as Element,
//             strings,
//             marker,
//             holes,
//             index,
//           );
//         }
//         break;
//       }
//       case Node.COMMENT_NODE: {
//         if (
//           stripTrailingSlash((currentNode as Comment).data).trim() === marker
//         ) {
//           holes.push({
//             type: PartType.ChildNode,
//             index,
//           });
//           (currentNode as Comment).data = '';
//         } else {
//           DEBUG: {
//             if ((currentNode as Comment).data.includes(marker)) {
//               throw new Error(
//                 'Expressions inside a comment must make up the entire comment value.',
//               );
//             }
//           }
//         }
//         break;
//       }
//       case Node.TEXT_NODE: {
//         const components = (currentNode as Text).data
//           .split(marker)
//           .map(stripWhitespaces);
//         const normalizedText = components.join('');
//         const tail = components.length - 1;
//         let lastComponent = components[0]!;
//
//         for (let i = 1; i <= tail; i++) {
//           const component = components[i]!;
//           holes.push({
//             type: PartType.Text,
//             index,
//             leadingSpan: lastComponent.length,
//             trailingSpan: i === tail ? component.length : 0,
//           });
//           lastComponent = component;
//         }
//
//         if (normalizedText === '' && components.length === 1) {
//           nextNode = sourceTree.nextNode();
//           (currentNode as Text).remove();
//           continue;
//         }
//
//         (currentNode as Text).data = normalizedText;
//
//         break;
//       }
//     }
//
//     nextNode = sourceTree.nextNode();
//     index++;
//   }
//
//   if (exprs.length !== holes.length) {
//     throw new Error(
//       `The number of holes must be ${exprs.length}, but got ${holes.length}. Multiple holes indicate the same attribute.`,
//     );
//   }
//
//   return holes;
// }
//
// function splitTextPart(
//   treeWalker: TreeWalker,
//   hole: Hole.TextHole,
// ): Part.TextPart {
//   let currentNode = treeWalker.currentNode as Text;
//   if (currentNode.previousSibling?.nodeType === Node.TEXT_NODE) {
//     currentNode = currentNode.splitText(0);
//   }
//   if (hole.leadingSpan > 0) {
//     currentNode = currentNode.splitText(hole.leadingSpan);
//   }
//   const part = createTextPart(currentNode);
//   if (hole.trailingSpan > 0) {
//     currentNode = currentNode.splitText(0);
//   }
//   treeWalker.currentNode = currentNode;
//   return part;
// }
//
// function stripTrailingSlash(s: string): string {
//   return s.at(-1) === '/' ? s.slice(0, -1) : s;
// }
//
// function stripWhitespaces(s: string): string {
//   if (LEADING_NEWLINE_PATTERN.test(s)) {
//     s = s.trimStart();
//   }
//   if (TRAILING_NEWLINE_PATTERN.test(s)) {
//     s = s.trimEnd();
//   }
//   return s;
// }
