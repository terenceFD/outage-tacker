import createMiddleware from "next-intl/middleware";
import { routing } from "./src/i18n/routing";
import { updateSession } from "./src/lib/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

export default async function middleware(
  request: Parameters<typeof intlMiddleware>[0],
) {
  // Refresh Supabase auth session first (sets updated cookies),
  // then apply locale routing.
  const response = await updateSession(request);
  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
