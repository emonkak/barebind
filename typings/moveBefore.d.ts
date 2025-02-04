interface ParentNode {
  moveBefore<T extends Node>(node: T, child: Node | null): T;
}
