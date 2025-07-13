import type { CustomHook, HookContext } from '../../hook.js';
import {
  anyModifiersArePressed,
  CurrentLocation,
  isInternalLink,
  type LocationNavigator,
  type LocationState,
  type NavigateOptions,
  type NavigationType,
} from './location.js';
import { RelativeURL } from './url.js';

export const BrowserLocation: CustomHook<
  readonly [LocationState, LocationNavigator]
> = {
  onCustomHook(
    context: HookContext,
  ): readonly [LocationState, LocationNavigator] {
    const [locationState, setLocationState] = context.useState<LocationState>(
      () => ({
        url: RelativeURL.fromLocation(location),
        state: history.state,
        navigationType: 'initial',
      }),
    );
    const locationNavigator = context.useMemo<LocationNavigator>(
      () => ({
        getCurrentURL: () => RelativeURL.fromLocation(location),
        navigate: (
          url: string | RelativeURL,
          { replace = false, state = null }: NavigateOptions = {},
        ) => {
          let navigationType: NavigationType;
          if (replace) {
            history.replaceState(state, '', url.toString());
            navigationType = 'replace';
          } else {
            history.pushState(state, '', url.toString());
            navigationType = 'push';
          }
          setLocationState({
            url: RelativeURL.from(url),
            state,
            navigationType,
          });
        },
      }),
      [],
    );

    context.useLayoutEffect(() => {
      const handlePopState = (event: PopStateEvent) => {
        setLocationState((prevState) => {
          if (
            prevState.url.pathname === location.pathname &&
            prevState.url.search === location.search
          ) {
            // Ignore an event when the hash has only changed.
            return prevState;
          }
          return {
            url: RelativeURL.fromLocation(location),
            state: event.state,
            navigationType: 'traverse',
          };
        });
      };
      const handleClick = createLinkClickHandler(locationNavigator);
      const handleSubmit = createFormSubmitHandler(locationNavigator);
      addEventListener('click', handleClick);
      addEventListener('submit', handleSubmit);
      addEventListener('popstate', handlePopState);
      return () => {
        removeEventListener('click', handleClick);
        removeEventListener('submit', handleSubmit);
        removeEventListener('popstate', handlePopState);
      };
    }, []);

    const currentLocation = [locationState, locationNavigator] as const;

    context.setContextValue(CurrentLocation, currentLocation);

    return currentLocation;
  },
};

export function createLinkClickHandler({
  navigate,
}: LocationNavigator): (event: MouseEvent) => void {
  return (event) => {
    if (
      anyModifiersArePressed(event) ||
      event.button !== 0 ||
      event.defaultPrevented
    ) {
      return;
    }

    const element = (event.composedPath() as Element[]).find(isInternalLink);
    if (
      element === undefined ||
      element.origin !== location.origin ||
      element.getAttribute('href')!.startsWith('#')
    ) {
      return;
    }

    event.preventDefault();

    const url = RelativeURL.fromLocation(element);
    const replace =
      element.hasAttribute('data-link-replace') ||
      element.href === location.href;

    navigate(url, { replace });
  };
}

export function createFormSubmitHandler({
  navigate,
}: LocationNavigator): (event: SubmitEvent) => void {
  return (event) => {
    if (event.defaultPrevented) {
      return;
    }

    const form = event.target as HTMLFormElement;
    const submitter = event.submitter as
      | HTMLButtonElement
      | HTMLInputElement
      | null;

    const method = submitter?.formMethod ?? form.method;
    if (method !== 'get') {
      return;
    }

    const action = new URL(submitter?.formAction ?? form.action);
    if (action.origin !== location.origin) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    // Action's search params are replaced with form data.
    const url = new RelativeURL(
      action.pathname,
      new FormData(form, submitter) as any,
      action.hash,
    );
    const replace =
      form.hasAttribute('data-link-replace') ||
      url.toString() === location.href;

    navigate(url, { replace });
  };
}
