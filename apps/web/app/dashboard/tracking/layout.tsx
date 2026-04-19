import { AppLayout } from "@/components/navigation/app-layout";

export default function TrackingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout
      fullscreen
      breadcrumbs={[{ label: "navigation.items.tracking" }]}
    >
      {children}
    </AppLayout>
  );
}
