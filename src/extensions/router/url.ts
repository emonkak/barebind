export interface URLLike {
  pathname: string;
  search: string;
  hash: string;
}

type URLSearchParamsInput = ConstructorParameters<typeof URLSearchParams>[0];

export class RelativeURL {
  private readonly _pathname: string;

  private readonly _searchParams: URLSearchParams;

  private readonly _hash: string;

  static from(value: string | RelativeURL | URLLike): RelativeURL {
    if (value instanceof RelativeURL) {
      return value;
    }
    if (typeof value === 'object') {
      return RelativeURL.fromURL(value);
    }
    return RelativeURL.fromString(value);
  }

  static fromURL(url: URLLike): RelativeURL {
    const { pathname, search, hash } = url;
    return new RelativeURL(pathname, search, hash);
  }

  static fromString(
    urlString: string,
    base: string | URLLike = '',
  ): RelativeURL {
    // SAFETY: Relative URLs can always be safely initialized.
    const baseURL = new URL(
      typeof base === 'string' ? base : base.pathname,
      'file://',
    );
    const url = new URL(urlString, baseURL);
    return RelativeURL.fromURL(url);
  }

  constructor(pathname: string, search: URLSearchParamsInput = '', hash = '') {
    this._pathname = pathname;
    // URLSearchParams must be read-only to make RelativeURL immutable.
    this._searchParams = Object.freeze(new URLSearchParams(search));
    this._hash = hash;
  }

  get pathname(): string {
    return this._pathname;
  }

  get search(): string {
    return this._searchParams.size > 0
      ? '?' + decodeURIComponent(this._searchParams.toString())
      : '';
  }

  get searchParams(): URLSearchParams {
    return this._searchParams;
  }

  get hash(): string {
    return this._hash;
  }

  toJSON(): string {
    return this.toString();
  }

  toString(): string {
    return this._pathname + this.search + this._hash;
  }

  toURL(base: string | URL): URL {
    return new URL(this.toString(), base);
  }
}
