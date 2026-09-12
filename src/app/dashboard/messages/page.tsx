import { permanentRedirect } from "next/navigation";

export default async function MessagesPage() {
  permanentRedirect("/channels");
}
