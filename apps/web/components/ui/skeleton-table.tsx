import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  headers?: string[];
  showActions?: boolean;
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  headers = [],
  showActions = true,
}: SkeletonTableProps) {
  const actualColumns = showActions ? columns + 1 : columns;
  const tableHeaders = headers.length > 0 ? headers : Array(columns).fill("");

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {tableHeaders.map((header, index) => (
            <TableHead key={index}>
              {header || <Skeleton className="h-4 w-20" />}
            </TableHead>
          ))}
          {showActions && (
            <TableHead className="text-right">
              <Skeleton className="h-4 w-16 ml-auto" />
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array(rows)
          .fill(0)
          .map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {Array(columns)
                .fill(0)
                .map((_, cellIndex) => (
                  <TableCell key={cellIndex}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              {showActions && (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
      </TableBody>
    </Table>
  );
}

// Specific skeleton for agents table
export function AgentsTableSkeleton() {
  return (
    <SkeletonTable
      rows={5}
      columns={6}
      headers={["Name", "Type", "Description", "Model", "Status", "Created"]}
      showActions={true}
    />
  );
}

// Specific skeleton for WhatsApp instances table
export function WhatsAppInstancesTableSkeleton() {
  return (
    <SkeletonTable
      rows={3}
      columns={4}
      headers={["Name", "Phone Number", "Profile Name", "Status"]}
      showActions={true}
    />
  );
}

// Specific skeleton for team members table
export function TeamMembersTableSkeleton() {
  return (
    <SkeletonTable
      rows={4}
      columns={3}
      headers={["Member", "Role", "Joined"]}
      showActions={true}
    />
  );
}
