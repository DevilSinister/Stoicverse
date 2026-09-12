import { permanentRedirect } from "next/navigation";

/**
 * Channel and category editing is a settings section, not a page.
 *
 * This route rendered the legacy workspace with the structure editor bolted on
 * as a modal. `/creator/settings?section=channels` renders the same editor
 * inline, beside the roles and permission controls it has to agree with, so
 * phase 9 sends the old href there rather than keeping a second way in.
 */
export default function CreatorChannelsPage() {
  permanentRedirect("/creator/settings?section=channels");
}
