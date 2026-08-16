import { cookies } from "next/headers";

export const THEME_COOKIE = "barber-theme";

export async function getThemeFromCookie(): Promise<"dark" | "light"> {
  try {
    const value = (await cookies()).get(THEME_COOKIE)?.value;
    return value === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function themeCookieOptions(theme: "dark" | "light") {
  return {
    name: THEME_COOKIE,
    value: theme,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax" as const,
  };
}
