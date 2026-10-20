// src/components/ui/Skeleton.tsx
import { cn } from "@/lib/utils"; // We'll create this utility next

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-gray-200", className)}
      {...props}
    />
  );
}