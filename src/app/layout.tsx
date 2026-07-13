import type { Metadata, Viewport } from "next";
import type { CSSProperties, ReactNode } from "react";

import {
  DEFAULT_LOCALE,
  getDirection,
  getLanguageTag,
  t,
} from "@/lib/i18n";

import "./globals.css";

export const metadata: Metadata = {
  description: t(DEFAULT_LOCALE, "app.description"),
  title: {
    default: t(DEFAULT_LOCALE, "app.title"),
    template: `%s | ${t(DEFAULT_LOCALE, "app.title")}`,
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f5f7f4",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      dir={getDirection(DEFAULT_LOCALE)}
      lang={getLanguageTag(DEFAULT_LOCALE)}
    >
      <body
        style={
          {
            "--font-app":
              'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          } as CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
