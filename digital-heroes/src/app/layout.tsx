import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import ToastProvider from "@/components/Toast";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Digital Heroes · Play for someone else",
  description: "Golf performance tracking, monthly prize draws, and charity giving in one platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=DM+Sans:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🦸</text></svg>" />
      </head>
      <body>
        <AuthProvider>
          <ToastProvider>
            <Nav />
            <main>{children}</main>
            <footer className="site">
              <div className="wrap">
                Digital Heroes · demo build for the trainee selection process. Payments run in simulated
                test mode; everything else reads and writes a real Supabase project.
              </div>
            </footer>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
