import type { ReactNode } from "react";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const QA = process.env.NODE_ENV === "development" ? (await import("@qraft/qa")).QA : null;
  return (
    <html lang="en">
      <body>
        {children}
        {QA ? <QA endpoint="/review/api/qraft" editor="manual" /> : null}
      </body>
    </html>
  );
}
