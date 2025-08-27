import './globals.css'
import { inter } from './font'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SmartDevBox Web',
  description: 'Web-based coding assistant inspired by Blackbox AI Agent',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`min-h-screen antialiased ${inter.className}`}>
        {children}
      </body>
    </html>
  )
}
