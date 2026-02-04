import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface SkeletonPageLayoutProps {
  showFilters?: boolean;
  showCreateButton?: boolean;
  showTabs?: boolean;
  children?: React.ReactNode;
}

export function SkeletonPageLayout({
  showFilters = false,
  showCreateButton = true,
  showTabs = false,
  children,
}: SkeletonPageLayoutProps) {
  return (
    <div className="container mx-auto py-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <Skeleton className="h-8 w-48" /> {/* Page title */}
        {showCreateButton && <Skeleton className="h-10 w-32" />} {/* Create button */}
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex gap-4 mb-6">
          <Skeleton className="h-10 w-64" /> {/* Search input */}
          <Skeleton className="h-10 w-32" /> {/* Filter dropdown */}
        </div>
      )}

      {/* Tabs */}
      {showTabs && (
        <div className="mb-6">
          <div className="flex gap-2 border-b">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      )}

      {/* Main content */}
      <Card>
        <CardContent className="pt-6">
          {children}
        </CardContent>
      </Card>
    </div>
  );
}

// Specific skeleton for card-based detail pages
export function SkeletonDetailLayout() {
  return (
    <div className="container mx-auto py-6">
      {/* Breadcrumb/Back button */}
      <div className="mb-6">
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Header with title and actions */}
      <div className="flex justify-between items-start mb-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      {/* Tabs or content sections */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-28" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array(3)
                .fill(0)
                .map((_, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="h-8 w-16" />
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
