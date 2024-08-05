import {
  type Directive,
  type Part,
  PartType,
  isDirective,
  nameOf,
} from './baseTypes.js';

export type NonEmpty<T> = [T, ...T[]];

export const REPORT_MARKER = '[[USED IN HERE!]]';

export function ensureDirective<
  TExpectedClass extends abstract new (
    ...args: any[]
  ) => Directive<TExpectedValue>,
  TExpectedValue,
>(
  expectedClass: TExpectedClass,
  actualValue: unknown,
  part: Part,
): asserts actualValue is TExpectedValue {
  if (!(actualValue instanceof expectedClass)) {
    throw new Error(
      'A value must be a instance of ' +
        expectedClass.name +
        ' directive, but got "' +
        nameOf(actualValue) +
        '". Consider using choice(), condition() or dynamic() directive instead.\n' +
        reportPart(part),
    );
  }
}

export function ensureNonDirective(value: unknown, part: Part): void {
  if (isDirective(value)) {
    throw new Error(
      'A value must not be a directive, but got "' +
        nameOf(value) +
        '". Consider using choice(), condition() or dynamic() directive instead.\n' +
        reportPart(part),
    );
  }
}

export function reportPart(part: Part): string {
  const { parentNode } = part.node;
  if (parentNode instanceof Element) {
    const childNodes = parentNode.childNodes;
    let beforePart = '';
    let afterPart = '';
    for (let i = 0, l = childNodes.length; i < l; i++) {
      const childNode = childNodes[i]!;
      if (childNode === part.node) {
        for (i = i + 1; i < l; i++) {
          afterPart += toHTML(childNodes[i]!);
        }
        break;
      }
      beforePart += toHTML(childNode);
    }
    return (
      openTag(parentNode) +
      beforePart +
      formatPart(part) +
      afterPart +
      closeTag(parentNode)
    );
  } else {
    return formatPart(part);
  }
}

function addAttributes(element: Element, insideTag: string): string {
  const isSelfClosing = isSelfClosingTag(element);
  const offset = isSelfClosing ? 1 : element.tagName.length + 4;
  const unclosedOpenTag = element.outerHTML.slice(
    0,
    -(element.innerHTML.length + offset),
  );

  let output = unclosedOpenTag + ' ' + insideTag + '>';

  if (!isSelfClosing) {
    output += element.innerHTML + closeTag(element);
  }

  return output;
}

function closeTag(element: Element): string {
  return '</' + element.tagName.toLowerCase() + '>';
}

function escapeHTML(s: string): string {
  return new Option(s).innerHTML;
}

function formatPart(part: Part): string {
  switch (part.type) {
    case PartType.Attribute:
      return addAttributes(
        part.node,
        unquotedAttribute(part.name, REPORT_MARKER),
      );
    case PartType.ChildNode:
      return REPORT_MARKER + toHTML(part.node);
    case PartType.Element:
      return addAttributes(part.node, REPORT_MARKER);
    case PartType.Property:
      return addAttributes(
        part.node,
        unquotedAttribute('.' + part.name, REPORT_MARKER),
      );
    case PartType.Event:
      return addAttributes(
        part.node,
        unquotedAttribute('@' + part.name, REPORT_MARKER),
      );
    case PartType.Node:
      return REPORT_MARKER;
  }
}

function isSelfClosingTag(element: Element): boolean {
  return !element.outerHTML.endsWith(closeTag(element));
}

function openTag(element: Element): string {
  // Assumption: The element is not a self-closing tag.
  const offset = element.tagName.length + 3;
  return element.outerHTML.slice(0, -(element.innerHTML.length + offset));
}

function toHTML(node: Node): string {
  const wrapper = document.createElement('div');
  wrapper.appendChild(node.cloneNode(true));
  return wrapper.innerHTML;
}

function unquotedAttribute(name: string, value: string): string {
  return escapeHTML(name) + '=' + escapeHTML(value);
}
