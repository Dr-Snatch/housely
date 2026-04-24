import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Link from 'next/link'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'Housely — Does this neighbourhood fit your life?',
  description: 'AI-powered UK property suitability analysis using real government data.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-stone-50 text-stone-900 font-sans antialiased">
        <header className="sticky top-0 z-50 bg-white border-b border-stone-200">
          <div className="max-w-7xl mx-auto px-6 h-13 flex items-center gap-8">
            <Link href="/" className="text-lg font-black tracking-tight text-stone-900">
              Housely
            </Link>
            <nav className="flex items-center gap-1 text-sm font-medium text-stone-500">
              <Link href="/" className="px-3 py-1.5 rounded-md hover:bg-stone-100 hover:text-stone-900 transition-colors">
                Search
              </Link>
              <Link href="/profile" className="px-3 py-1.5 rounded-md hover:bg-stone-100 hover:text-stone-900 transition-colors">
                Profile
              </Link>
              <Link href="/matches" className="px-3 py-1.5 rounded-md hover:bg-stone-100 hover:text-stone-900 transition-colors">
                Matches
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  )
}
