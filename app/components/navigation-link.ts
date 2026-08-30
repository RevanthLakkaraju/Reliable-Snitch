import { createElement, type ComponentPropsWithRef } from "react";

/**
 * Use browser-native navigation for portal links. The hosted Vinext build's
 * client router throws after cancelling ordinary clicks; full document requests
 * work correctly. Native anchors preserve same-tab, keyboard, fragment, download
 * and open-in-new-tab behavior without depending on that router or prefetching.
 */
export default function NavigationLink(
  props: ComponentPropsWithRef<"a"> & { href: string },
) {
  return createElement("a", props);
}
