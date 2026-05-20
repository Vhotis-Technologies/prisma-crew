/**
 * Web stub: always returns `"light"` so SSR and client first paint match.
 * See React Native web color-scheme notes in file comments below.
 */
// NOTE: The default React Native styling doesn't support server rendering.
// Server rendered styles should not change between the first render of the HTML
// and the first render on the client. Typically, web developers will use CSS media queries
// to render different styles on the client and server, these aren't directly supported in React Native
// but can be achieved using a styling library like Nativewind.
/** Fixed light scheme on web for consistent server/client rendering. */
export function useColorScheme() {
  return 'light';
}
