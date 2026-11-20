import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RepoLens',
  description: 'Understand any GitHub codebase in seconds with client-side AST stripping and AI architecture diagrams.',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-slate-50 text-slate-900 antialiased selection:bg-indigo-100 selection:text-indigo-900">
        {children}
      </body>
    </html>
  );
}
