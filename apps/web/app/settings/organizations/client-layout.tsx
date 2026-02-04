'use client';

import { AppLayout } from '@/components/navigation/app-layout';

export default function OrganizationsClientLayout({ children }: { children: React.ReactNode }) {
  const breadcrumbs = [
    { label: 'navigation.settings', href: '/settings/organizations' },
    { label: 'navigation.items.organization' },
  ];

  return <AppLayout breadcrumbs={breadcrumbs}>{children}</AppLayout>;
}
