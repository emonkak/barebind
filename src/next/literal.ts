export class Literal {
  private readonly _value: string;

  constructor(value: string) {
    this._value = value;
  }

  valueOf(): string {
    return this._value;
  }

  toString(): string {
    return this._value;
  }
}
