"use client";

import { useAuth } from "@/lib/hooks/use-auth";
import { CreateOrganizationDialog } from "@/components/organizations";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const { organizations } = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    // If user has no organizations, show the create dialog
    if (organizations && organizations.length === 0) {
      setShowCreateDialog(true);
    }
  }, [organizations]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Your dashboard content will go here.
        </p>
      </div>

      <CreateOrganizationDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={() => {
          setShowCreateDialog(false);
        }}
      />
    </div>
  );
}
