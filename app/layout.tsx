import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';

export const metadata: Metadata = {
  title: 'RepoLens — Privacy-First AI Repository Architecture & Dependency Visualizer',
  description: 'Understand any GitHub codebase in seconds with client-side AST stripping and AI architecture diagrams.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-[#ffffff] text-[#1f2328] antialiased selection:bg-[#ddf4ff] selection:text-[#0969da]">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
