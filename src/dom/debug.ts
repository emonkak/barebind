const CARET_CHAR = '^';
const INDENT_STRING = '  ';
const PLACEHOLDER_STRING = '${...}';

// Minimum complexity score required to make a node identifiable.
const COMPLEXITY_THRESHOLD = 10;

const serializer = new XMLSerializer();

export function annotateAttribute(element: Element, name: string): string[] {
  return annotateElementTail(element, name + '=' + PLACEHOLDER_STRING);
}

export function annotateNode(node: Node): string[] {
  if (node instanceof Element) {
    return annotateElementHead(
      node,
      isUnknownElement(node) ? PLACEHOLDER_STRING : node.localName,
    );
  } else {
    return prettyPrintNode(node).flatMap((line) => {
      const caretSpan = Math.max(1, line.trimStart().length);
      const spaceSpan = line.length - caretSpan;
      return [line, ' '.repeat(spaceSpan) + CARET_CHAR.repeat(caretSpan)];
    });
  }
}

export function generateNodeFrame(
  node: Node,
  annotatedLines: string[],
): string {
  const leadingLines: string[] = [];
  const trailingLines: string[] = [];
  let currentNode: Node | null = node;
  let complexity = 0;
  let level = 0;

  do {
    for (
      let previousNode = currentNode.previousSibling;
      previousNode !== null;
      previousNode = previousNode.previousSibling
    ) {
      leadingLines.push(...prettyPrintNode(previousNode).reverse());
      complexity += getComplexity(previousNode);
    }

    for (
      let nextNode = currentNode.nextSibling;
      nextNode !== null;
      nextNode = nextNode.nextSibling
    ) {
      trailingLines.push(...prettyPrintNode(nextNode));
      complexity += getComplexity(nextNode);
    }

    currentNode = currentNode.parentNode;

    if (!(currentNode instanceof Element)) {
      break;
    }

    shiftLines(leadingLines);
    shiftLines(trailingLines);

    // Not self-closing because it contains child nodes.
    leadingLines.push(toOpenTag(currentNode));
    trailingLines.push(toCloseTag(currentNode));

    complexity += getComplexity(currentNode);
    level++;
  } while (complexity < COMPLEXITY_THRESHOLD);

  const leadingString =
    leadingLines.length > 0 ? leadingLines.reverse().join('\n') + '\n' : '';
  const trailingString =
    trailingLines.length > 0 ? '\n' + trailingLines.join('\n') : '';
  const annotatedString = annotatedLines
    .map((line) => INDENT_STRING.repeat(level) + line)
    .join('\n');

  return leadingString + annotatedString + trailingString;
}

function annotateElementHead(element: Element, annotation: string): string[] {
  const isClosed = isTagClosed(element);
  const tailSpan = isClosed ? 0 : element.localName.length + 3;
  const outerHTML = element.outerHTML;
  const unopenedTag = outerHTML.substring(
    element.localName.length + 1,
    outerHTML.length - element.innerHTML.length - tailSpan,
  );

  const lines = [
    '<' + PLACEHOLDER_STRING + unopenedTag,
    ' ' + CARET_CHAR.repeat(annotation.length),
  ];

  if (!isClosed) {
    lines.push(...prettyPrintChildren(element, 1), toCloseTag(element));
  }

  return lines;
}

function annotateElementTail(element: Element, annotation: string): string[] {
  const isClosed = isTagClosed(element);
  const tailSpan = isClosed ? 1 : element.localName.length + 4;
  const outerHTML = element.outerHTML;
  const unclosedTag = outerHTML.slice(
    0,
    outerHTML.length - element.innerHTML.length - tailSpan,
  );

  const lines = [
    unclosedTag + ' ' + annotation + '>',
    ' '.repeat(unclosedTag.length + 1) + CARET_CHAR.repeat(annotation.length),
  ];

  if (!isClosed) {
    lines.push(...prettyPrintChildren(element, 1), toCloseTag(element));
  }

  return lines;
}

function getComplexity(node: Node): number {
  let complexity = 0;
  switch (node.nodeType) {
    case Node.ELEMENT_NODE:
      complexity +=
        1 +
        (node as Element).classList.length +
        (node as Element).attributes.length;
      break;
    case Node.TEXT_NODE:
    case Node.COMMENT_NODE:
      if ((node as CharacterData).data.trim() !== '') {
        complexity++;
      }
      break;
  }
  return complexity;
}

function isTagClosed(element: Element): boolean {
  return !element.outerHTML.endsWith(toCloseTag(element));
}

function isUnknownElement(el: Element): boolean {
  return (
    el.constructor === HTMLUnknownElement ||
    el.constructor === SVGElement ||
    el.constructor === MathMLElement
  );
}

function prettyPrintChildren(node: Node, level: number): string[] {
  const lines: string[] = [];

  for (let child = node.firstChild; child !== null; child = child.nextSibling) {
    lines.push(...prettyPrintNode(child, level));
  }

  return lines;
}

function prettyPrintNode(node: Node, level: number = 0): string[] {
  const lines: string[] = [];
  const indentString = INDENT_STRING.repeat(level);

  if (node instanceof Element) {
    if (isTagClosed(node)) {
      lines.push(indentString + node.outerHTML);
      return lines;
    }

    lines.push(
      indentString + toOpenTag(node),
      ...prettyPrintChildren(node, level + 1),
    );

    if (lines.length > 1) {
      lines.push(indentString + toCloseTag(node));
    } else {
      lines[0] += toCloseTag(node);
    }
  } else if (node instanceof DocumentFragment) {
    lines.push(...prettyPrintChildren(node, level));
  } else if (node instanceof Text) {
    lines.push(indentString + JSON.stringify(node.data));
  } else {
    lines.push(indentString + serializeNode(node));
  }

  return lines;
}

function serializeNode(node: Node): string {
  return serializer.serializeToString(node);
}

function shiftLines(lines: string[]): void {
  for (let i = 0, l = lines.length; i < l; i++) {
    if (lines[i] !== '') {
      lines[i] = INDENT_STRING + lines[i];
    }
  }
}

function toCloseTag(element: Element): string {
  return '</' + element.localName + '>';
}

function toOpenTag(element: Element): string {
  // Assumption: The tag is not self-closing.
  const offset = element.localName.length + 3;
  return element.outerHTML.slice(0, -(element.innerHTML.length + offset));
}
