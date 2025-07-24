import {
  $customHook,
  type CustomHookObject,
  type HookContext,
} from '../../core.js';
import {
  anyModifiersArePressed,
  CurrentLocation,
  isInternalLink,
  type LocationNavigator,
  type LocationSnapshot,
  type NavigateOptions,
  trimHash,
} from './location.js';
import { RelativeURL } from './url.js';

export const HashLocation: CustomHookObject<
  readonly [LocationSnapshot, LocationNavigator]
> = {
  [$customHook](
    context: HookContext,
  ): readonly [LocationSnapshot, LocationNavigator] {
    const [locationState, setLocationState] = context.useState<{
      snapshot: LocationSnapshot;
      navigator: LocationNavigator;
    }>(() => ({
      snapshot: {
        url: RelativeURL.fromString(trimHash(location.hash)),
        state: history.state,
        navigationType: null,
      },
      navigator: {
        getCurrentURL: () => RelativeURL.fromString(trimHash(location.hash)),
        navigate: (
          url: string | RelativeURL,
          { replace = false, state = null }: NavigateOptions = {},
        ) => {
          let navigationType: NavigationType;
          if (replace) {
            history.replaceState(state, '', '#' + url);
            navigationType = 'replace';
          } else {
            history.pushState(state, '', '#' + url);
            navigationType = 'push';
          }
          setLocationState(({ navigator }) => ({
            snapshot: {
              url: RelativeURL.from(url),
              state,
              navigationType,
            },
            navigator,
          }));
        },
      },
    }));

    const { snapshot, navigator } = locationState;

    context.useLayoutEffect(() => {
      // Prevent the default action when hash link is clicked. So, "hashchange"
      // event is canceled and the location type is detected correctly.
      const handleClick = createHashClickHandler(navigator);
      // BUGS: "hashchange" event is fired other than when navigating through
      // history entries by back/forward action. For instance, when a link is
      // clicked or a new URL is entered in the address bar. Therefore the
      // location type cannot be detected completely correctly.
      const handleHashChange = (event: HashChangeEvent) => {
        setLocationState(({ navigator }) => ({
          snapshot: {
            url: RelativeURL.fromString(trimHash(new URL(event.newURL).hash)),
            state: history.state,
            navigationType: 'traverse',
          },
          navigator,
        }));
      };

      addEventListener('click', handleClick);
      addEventListener('hashchange', handleHashChange);

      return () => {
        removeEventListener('click', handleClick);
        removeEventListener('hashchange', handleHashChange);
      };
    }, []);

    const currentLocation = [snapshot, navigator] as const;

    context.setContextValue(CurrentLocation, currentLocation);

    return currentLocation;
  },
};

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
