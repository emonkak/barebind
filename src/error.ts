import {
  type Directive,
  type Part,
  PartType,
  isDirective,
  nameOf,
} from './baseTypes.js';

type DirectiveClass<TValue> = abstract new (
  ...args: any[]
) => Directive<TValue>;

type NonEmptyArray<T> = [T, ...T[]];

export const REPORT_MARKER = '[[USED IN HERE!]]';

export function ensureDirective<
  TExpectedClasses extends NonEmptyArray<DirectiveClass<TExpectedValue>>,
  TExpectedValue,
>(
  expectedClasses: TExpectedClasses,
  actualValue: unknown,
  part: Part,
): asserts actualValue is TExpectedValue {
  if (
    !expectedClasses.some(
      (expectedClass) => actualValue instanceof expectedClass,
    )
  ) {
    throw new Error(
      'A value must be a instance of ' +
        oneOf(expectedClasses.map((expectedClass) => expectedClass.name)) +
        ' directive, but got "' +
        nameOf(actualValue) +
        '". Consider using Either.left(), Either.right(), cached(), or keyed() directive instead.\n' +
        reportPart(part),
    );
  }
}

export function ensureNonDirective(value: unknown, part: Part): void {
  if (isDirective(value)) {
    throw new Error(
      'A value must not be a directive, but got "' +
        nameOf(value) +
        '". Consider using cached(), condition() or dynamic() directive instead.\n' +
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
      markPart(part) +
      afterPart +
      closeTag(parentNode)
    );
  } else {
    return markPart(part);
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

function isSelfClosingTag(element: Element): boolean {
  return !element.outerHTML.endsWith(closeTag(element));
}

function markPart(part: Part): string {
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

function oneOf(choices: string[]): string {
  return choices.length > 2
    ? choices.slice(0, -1).join(', ') + ', or ' + choices.at(-1)
    : choices.join(' or ');
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
