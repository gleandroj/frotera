'use client';

import { AppLayout } from '@/components/navigation/app-layout';

export default function NotificationsClientLayout({ children }: { children: React.ReactNode }) {
  const breadcrumbs = [
    { label: 'navigation.items.notifications', href: '/notifications' },
  ];

  return <AppLayout breadcrumbs={breadcrumbs}>{children}</AppLayout>;
}
