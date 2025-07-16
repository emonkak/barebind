import type { CustomHook, HookContext } from '../../core.js';
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

export const HashLocation: CustomHook<
  readonly [LocationSnapshot, LocationNavigator]
> = {
  onCustomHook(
    context: HookContext,
  ): readonly [LocationSnapshot, LocationNavigator] {
    const [locationSnapshot, setLocationSnapshot] =
      context.useState<LocationSnapshot>(() => ({
        url: RelativeURL.fromString(trimHash(location.hash)),
        state: history.state,
        navigationType: null,
      }));
    const locationNavigator = context.useMemo<LocationNavigator>(
      () => ({
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
          setLocationSnapshot({
            url: RelativeURL.from(url),
            state,
            navigationType,
          });
        },
      }),
      [],
    );

    context.useLayoutEffect(() => {
      // Prevent the default action when hash link is clicked. So, "hashchange"
      // event is canceled and the location type is detected correctly.
      const handleClick = createHashClickHandler(locationNavigator);
      // BUGS: "hashchange" event is fired other than when navigating through
      // history entries by back/forward action. For instance, when a link is
      // clicked or a new URL is entered in the address bar. Therefore the
      // location type cannot be detected completely correctly.
      const handleHashChange = (event: HashChangeEvent) => {
        setLocationSnapshot({
          url: RelativeURL.fromString(trimHash(new URL(event.newURL).hash)),
          state: history.state,
          navigationType: 'traverse',
        });
      };
      addEventListener('click', handleClick);
      addEventListener('hashchange', handleHashChange);
      return () => {
        removeEventListener('click', handleClick);
        removeEventListener('hashchange', handleHashChange);
      };
    }, []);

    const currentLocation = [locationSnapshot, locationNavigator] as const;

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
