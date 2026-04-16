'use client';

import { AppLayout } from '@/components/navigation/app-layout';
import { usePathname } from 'next/navigation';

export default function TeamClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const breadcrumbs = pathname === '/team/new'
    ? [
        { label: 'navigation.items.teamMembers', href: '/team' },
        { label: 'team.createUserDialog.newUserPageTitle' },
      ]
    : [{ label: 'navigation.items.teamMembers', href: '/team' }];

  return <AppLayout breadcrumbs={breadcrumbs}>{children}</AppLayout>;
}
