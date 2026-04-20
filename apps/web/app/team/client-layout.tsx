'use client';

import { AppLayout } from '@/components/navigation/app-layout';

export default function TeamClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout breadcrumbs={[{ label: 'navigation.items.teamMembers', href: '/team' }]}>
      {children}
    </AppLayout>
  );
}
