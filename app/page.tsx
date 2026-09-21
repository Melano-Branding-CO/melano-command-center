import type { Metadata } from 'next'
import { CommandCenter } from '@/components/command-center'

export const metadata: Metadata = {
  title: 'Command Center | Melano Inc',
  description:
    'Melano Inc autonomous command center for AI, automation, operations, and business impact.',
  applicationName: 'Melano Inc Command Center',
  keywords: [
    'Melano Inc',
    'AI command center',
    'business automation',
    'autonomous agents',
    'operations dashboard',
  ],
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  openGraph: {
    title: 'Command Center | Melano Inc',
    description:
      'Autonomous command center for AI, automation, operations, and business impact.',
    type: 'website',
    siteName: 'Melano Inc',
  },
  twitter: {
    card: 'summary',
    title: 'Command Center | Melano Inc',
    description:
      'Autonomous command center for AI, automation, operations, and business impact.',
  },
}

export default function Page() {
  return <CommandCenter />
}
