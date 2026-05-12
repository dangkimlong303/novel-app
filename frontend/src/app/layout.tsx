import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Novel Reader',
  description: 'Read Shadow Slave chapters',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-6">
            <a href="/" className="font-bold text-lg">Novel Reader</a>
            {process.env.NEXT_PUBLIC_ADMIN_ENABLED === 'true' && (
              <a href="/admin" className="text-sm text-gray-600 hover:text-gray-900">Admin</a>
            )}
          </div>
        </nav>
        <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
