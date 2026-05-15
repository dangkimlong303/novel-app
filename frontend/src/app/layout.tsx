import type { Metadata } from 'next';
import './globals.css';
import DarkModeInit from '@/components/DarkModeInit';
import DarkModeToggle from '@/components/DarkModeToggle';

export const metadata: Metadata = {
  title: {
    default: 'Shadow Slave — Read Free Online | Novel Reader',
    template: '%s | Novel Reader',
  },
  description: 'Read Shadow Slave novel online for free.',
  openGraph: {
    images: ['/cover.jpg'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <DarkModeInit />
      </head>
      <body className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <nav className="bg-white shadow-sm border-b dark:bg-gray-900 dark:border-gray-800">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-6">
            <a href="/" className="font-bold text-lg">Novel Reader</a>
            {process.env.NEXT_PUBLIC_ADMIN_ENABLED === 'true' && (
              <a href="/admin" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">Admin</a>
            )}
            <div className="ml-auto">
              <DarkModeToggle />
            </div>
          </div>
        </nav>
        <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
