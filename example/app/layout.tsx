import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'a11y-tree — in-browser agent demo',
  description: 'A conversation agent that drives the very page you are on, via a11y-tree.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
