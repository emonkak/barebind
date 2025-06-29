interface Entry {
  key: unknown;
  value: unknown;
}

export class Scope {
  private readonly _parent: Scope | null;

  private readonly _entries: Entry[] = [];

  constructor(parent: Scope | null) {
    this._parent = parent;
  }

  get(key: unknown): unknown {
    let currentScope: Scope | null = this;
    do {
      for (let i = currentScope._entries.length - 1; i >= 0; i--) {
        const entry = currentScope._entries[i]!;
        if (entry.key === key) {
          return entry.value;
        }
      }
      currentScope = currentScope._parent;
    } while (currentScope !== null);
    return undefined;
  }

  set(key: unknown, value: unknown): void {
    this._entries.push({ key, value });
  }
}
