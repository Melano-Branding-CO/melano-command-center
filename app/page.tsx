import type { Metadata } from 'next'
import { CommandCenter } from '@/components/command-center'

export const metadata: Metadata = {
  title: 'Command Center | Melano Inc',
  description: 'Melano Inc autonomous command center for AI, automation, and impact.',
}

export default function Page() {
  return <CommandCenter />
}
