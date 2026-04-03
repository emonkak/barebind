export function createElement<const TName extends keyof HTMLElementTagNameMap>(
  name: TName,
  attributes: { namespaceURI?: string; [key: string]: string } = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[TName] {
  const element = document.createElement(name);
  for (const key in attributes) {
    element.setAttribute(key, attributes[key]!);
  }
  for (const child of children) {
    element.appendChild(
      child instanceof Node ? child : document.createTextNode(child),
    );
  }
  return element;
}
