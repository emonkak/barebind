export interface URLLike {
  pathname: string;
  search: string;
  hash: string;
}

type URLSearchParamsInput = ConstructorParameters<typeof URLSearchParams>[0];

export class RelativeURL {
  readonly pathname: string;

  readonly searchParams: URLSearchParams;

  readonly hash: string;

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
    this.pathname = pathname;
    this.searchParams = new URLSearchParams(search);
    this.hash = hash;
    DEBUG: {
      Object.freeze(this);
      Object.freeze(this.searchParams);
    }
  }

  get search(): string {
    return this.searchParams.size > 0
      ? '?' + decodeURIComponent(this.searchParams.toString())
      : '';
  }

  toJSON(): string {
    return this.toString();
  }

  toString(): string {
    return this.pathname + this.search + this.hash;
  }

  toURL(base: string | URL): URL {
    return new URL(this.toString(), base);
  }
}
