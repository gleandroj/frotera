'use client';

import { AppLayout } from '@/components/navigation/app-layout';

export default function ProfileClientLayout({ children }: { children: React.ReactNode }) {
  const breadcrumbs = [
    { label: 'navigation.settings', href: '/settings/profile' },
    { label: 'navigation.items.profile' },
  ];

  return <AppLayout breadcrumbs={breadcrumbs}>{children}</AppLayout>;
}
