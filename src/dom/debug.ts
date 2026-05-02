const CARET_CHAR = '^';
const SPACE_CHAR = ' ';

const INDENT_STRING = '  ';

// Minimum complexity score required to make a node identifiable.
const COMPLEXITY_THRESHOLD = 10;

const serializer = new XMLSerializer();

export function generateNodeFrame(node: Node): string {
  let leadingLines: string[] = [];
  let trailingLines: string[] = [];
  let currentNode: Node | null =
    node.nodeType === Node.ATTRIBUTE_NODE ? (node as Attr).ownerElement! : node;
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
      prettyPrintNode(nextNode, 0, trailingLines);
      complexity += getComplexity(nextNode);
    }

    currentNode = currentNode.parentNode;

    if (currentNode === null || currentNode.nodeType !== Node.ELEMENT_NODE) {
      break;
    }

    leadingLines = leadingLines.map(shiftLine);
    trailingLines = trailingLines.map(shiftLine);
    leadingLines.push(toOpenTag(currentNode as Element));
    trailingLines.push(toCloseTag(currentNode as Element));

    complexity += getComplexity(currentNode);
    level++;
  } while (complexity < COMPLEXITY_THRESHOLD);

  const indentString = INDENT_STRING.repeat(level);
  const leadingString =
    leadingLines.length > 0 ? leadingLines.reverse().join('\n') + '\n' : '';
  const trailingString =
    trailingLines.length > 0 ? '\n' + trailingLines.join('\n') : '';
  const middleString = annotateNode(node)
    .map((line) => indentString + line)
    .join('\n');

  return leadingString + middleString + trailingString;
}

function annotateAttribute(attribute: Attr): string[] {
  const element = attribute.ownerElement!;
  const components = splitAttributes(element);
  const prefix = attribute.name + '=';
  const lines = [
    `<${element.localName} ${components.join(SPACE_CHAR)}>`,
    (
      SPACE_CHAR.repeat(element.localName.length + 2) +
      components
        .map((component) =>
          (component.startsWith(prefix) ? CARET_CHAR : SPACE_CHAR).repeat(
            component.length,
          ),
        )
        .join(SPACE_CHAR)
    ).trimEnd(),
  ];

  if (!isVoidElement(element)) {
    prettyPrintChildren(element, 1, lines);
    lines.push(toCloseTag(element));
  }

  return lines;
}

function annotateElement(element: Element): string[] {
  const openTag = toOpenTag(element);
  const lines = [openTag, CARET_CHAR.repeat(openTag.length)];

  if (!isVoidElement(element)) {
    prettyPrintChildren(element, 1, lines);
    lines.push(toCloseTag(element));
  }

  return lines;
}

function annotateNode(node: Node): string[] {
  switch (node.nodeType) {
    case Node.ATTRIBUTE_NODE:
      return annotateAttribute(node as Attr);
    case Node.ELEMENT_NODE:
      return annotateElement(node as Element);
    case Node.COMMENT_NODE: {
      const line = serializeNode(node);
      return [line, CARET_CHAR.repeat(line.length)];
    }
    case Node.TEXT_NODE: {
      const line = serializeNode(node);
      return [`"${line}"`, CARET_CHAR.repeat(line.length + 2)];
    }
    default: {
      const lines = [
        `<${node.nodeName}>`,
        CARET_CHAR.repeat(node.nodeName.length + 2),
      ];
      prettyPrintChildren(node, 1, lines);
      lines.push(`</${node.nodeName}>`);
      return lines;
    }
  }
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

function isVoidElement(element: Element): boolean {
  return !element.outerHTML.endsWith(toCloseTag(element));
}

function prettyPrintChildren(node: Node, level: number, lines: string[]): void {
  for (let child = node.firstChild; child !== null; child = child.nextSibling) {
    prettyPrintNode(child, level, lines);
  }
}

function prettyPrintNode(
  node: Node,
  level: number = 0,
  lines: string[] = [],
): string[] {
  const indentString = INDENT_STRING.repeat(level);

  switch (node.nodeType) {
    case Node.ELEMENT_NODE:
      lines.push(indentString + toOpenTag(node as Element));

      if (isVoidElement(node as Element)) {
        return lines;
      }

      prettyPrintChildren(node, level + 1, lines);

      if (lines.length > 1) {
        lines.push(indentString + toCloseTag(node as Element));
      } else {
        lines[0] += toCloseTag(node as Element);
      }
      break;
    case Node.COMMENT_NODE:
      lines.push(indentString + serializeNode(node));
      break;
    case Node.TEXT_NODE:
      lines.push(`${indentString}"${serializeNode(node)}"`);
      break;
  }

  return lines;
}

function serializeNode(node: Node): string {
  return serializer.serializeToString(node);
}

function shiftLine(line: string): string {
  return line !== '' ? INDENT_STRING + line : line;
}

function splitAttributes(element: Element): string[] {
  return Array.from(element.attributes, (attribute) => {
    const wrapper = element.ownerDocument.createElement('br');
    wrapper.setAttributeNS(
      attribute.namespaceURI,
      attribute.name,
      attribute.value,
    );
    return wrapper.outerHTML.slice(4, -1);
  });
}

function toCloseTag(element: Element): string {
  return `</${element.localName}>`;
}

function toOpenTag(element: Element): string {
  const html = element.outerHTML;
  return html.slice(0, html.indexOf('>') + 1);
}
