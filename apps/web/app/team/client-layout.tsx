'use client';

import { AppLayout } from '@/components/navigation/app-layout';

export default function TeamClientLayout({ children }: { children: React.ReactNode }) {
  const breadcrumbs = [
    { label: 'navigation.items.teamMembers', href: '/team' },
  ];

  return <AppLayout breadcrumbs={breadcrumbs}>{children}</AppLayout>;
}
