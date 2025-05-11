import { type HookContext, type UserHook, userHookTag } from '../hook.js';
import {
  CurrentLocationContext,
  type LocationNavigator,
  type LocationState,
  type NavigateOptions,
  type NavigationType,
  anyModifiersArePressed,
  isInternalLink,
} from './location.js';
import { RelativeURL } from './relativeURL.js';

export const BrowserLocation: UserHook<
  readonly [LocationState, LocationNavigator]
> = {
  [userHookTag](
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
          url: RelativeURL,
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
            url,
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
      const handleClick = createBrowserClickHandler(locationNavigator);
      const handleSubmit = createBrowserSubmitHandler(locationNavigator);
      addEventListener('popstate', handlePopState);
      addEventListener('click', handleClick);
      addEventListener('submit', handleSubmit);
      return () => {
        removeEventListener('popstate', handlePopState);
        removeEventListener('click', handleClick);
        removeEventListener('submit', handleSubmit);
      };
    }, []);

    context.setContextualValue(CurrentLocationContext, [
      locationState,
      locationNavigator,
    ]);

    return [locationState, locationNavigator] as const;
  },
};

/**
 * @internal
 */
export function createBrowserClickHandler({
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

/**
 * @internal
 */
export function createBrowserSubmitHandler({
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
