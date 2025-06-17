import { type HookContext, type UserHook, userHookTag } from '../hook.js';
import {
  CurrentLocation,
  type LocationNavigator,
  type LocationState,
  type NavigateOptions,
  type NavigationType,
  anyModifiersArePressed,
  isInternalLink,
  trimHash,
} from './location.js';
import { RelativeURL } from './relativeURL.js';

export const HashLocation: UserHook<
  readonly [LocationState, LocationNavigator]
> = {
  [userHookTag](
    context: HookContext,
  ): readonly [LocationState, LocationNavigator] {
    const [locationState, setLocationState] = context.useState<LocationState>(
      () => ({
        url: RelativeURL.fromString(trimHash(location.hash)),
        state: history.state,
        navigationType: 'initial',
      }),
    );
    const locationNavigator = context.useMemo<LocationNavigator>(
      () => ({
        getCurrentURL: () => RelativeURL.fromString(trimHash(location.hash)),
        navigate: (
          url: RelativeURL,
          { replace = false, state = null }: NavigateOptions = {},
        ) => {
          let navigationType: NavigationType;
          if (replace) {
            history.replaceState(state, '', '#' + url.toString());
            navigationType = 'replace';
          } else {
            history.pushState(state, '', '#' + url.toString());
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
      // BUGS: "hashchange" event is fired other than when navigating through
      // history entries by back/forward action. For instance, when a link is
      // clicked or a new URL is entered in the address bar. Therefore the
      // location type cannot be detected completely correctly.
      const handleHashChange = (event: HashChangeEvent) => {
        setLocationState({
          url: RelativeURL.fromString(trimHash(new URL(event.newURL).hash)),
          state: history.state,
          navigationType: 'traverse',
        });
      };
      // Prevent the default action when hash link is clicked. So, "hashchange"
      // event is canceled and the location type is detected correctly.
      const handleClick = createHashClickHandler(locationNavigator);
      addEventListener('hashchange', handleHashChange);
      addEventListener('click', handleClick);
      return () => {
        removeEventListener('hashchange', handleHashChange);
        removeEventListener('click', handleClick);
      };
    }, []);

    context.setContextValue(CurrentLocation, [
      locationState,
      locationNavigator,
    ]);

    return [locationState, locationNavigator] as const;
  },
};

/**
 * @internal
 */
export function createHashClickHandler({
  getCurrentURL,
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
      !element.getAttribute('href')!.startsWith('#')
    ) {
      return;
    }

    event.preventDefault();

    const base = getCurrentURL();
    const url = RelativeURL.fromString(trimHash(element.hash), base);
    const replace =
      element.hasAttribute('data-link-replace') ||
      element.hash === location.hash;

    navigate(url, { replace });
  };
}
