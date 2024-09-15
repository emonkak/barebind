export interface LocationLike {
  pathname: string;
  search: string;
  hash: string;
}

type URLSearchParamsInput = ConstructorParameters<typeof URLSearchParams>[0];

export class RelativeURL {
  private readonly _pathname: string;

  private readonly _searchParams: URLSearchParams;

  private readonly _hash: string;

  static from(value: RelativeURL | URL | LocationLike | string): RelativeURL {
    if (value instanceof RelativeURL) {
      return value;
    }
    if (value instanceof URL) {
      return RelativeURL.fromURL(value);
    }
    if (typeof value === 'object') {
      return RelativeURL.fromLocation(value);
    }
    return RelativeURL.fromString(value);
  }

  static fromLocation(location: LocationLike): RelativeURL {
    const { pathname, search, hash } = location;
    return new RelativeURL(pathname, search, hash);
  }

  static fromString(
    urlString: string,
    base: string | RelativeURL = '',
  ): RelativeURL {
    // SAFETY: Relative URLs can always be safely initialized.
    const baseURL = new URL(
      typeof base === 'string' ? base : base.pathname,
      'file://',
    );
    const url = new URL(urlString, baseURL);
    return RelativeURL.fromURL(url);
  }

  static fromURL(url: URL): RelativeURL {
    const { pathname, searchParams, hash } = url;
    return new RelativeURL(pathname, searchParams, hash);
  }

  constructor(pathname: string, search: URLSearchParamsInput = '', hash = '') {
    this._pathname = pathname;
    this._searchParams = new URLSearchParams(search);
    this._hash = hash;
  }

  get pathname(): string {
    return this._pathname;
  }

  get search(): string {
    return this._searchParams.size > 0
      ? '?' + this._searchParams.toString()
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

  toURL(base: URL | string): URL {
    return new URL(this.toString(), base);
  }
}
