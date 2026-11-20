import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RepoLens — Zero-Trust Repository Architecture Studio',
  description:
    'Understand any GitHub codebase in seconds with local browser AST stripping and AI architecture mapping.',
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
    <html lang="en" className={`h-full scroll-smooth ${plusJakarta.variable} ${jetbrainsMono.variable}`}>
      <body className="h-full bg-[#09090B] text-[#09090B] font-sans antialiased selection:bg-[#09090B] selection:text-white">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
