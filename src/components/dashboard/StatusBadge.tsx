interface StatusBadgeProps {
  status: string;
  customStyles?: Record<string, string>;
  size?: "sm" | "md";
}

const defaultStyles: Record<string, string> = {
  // Seller verification statuses
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  VERIFIED: "bg-green-100 text-green-800 border-green-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
  SUSPENDED: "bg-gray-100 text-gray-800 border-gray-200",
  
  // Product statuses
  DRAFT: "bg-blue-100 text-blue-800 border-blue-200",
  ACTIVE: "bg-green-100 text-green-800 border-green-200",
  OUT_OF_STOCK: "bg-orange-100 text-orange-800 border-orange-200",
  ARCHIVED: "bg-gray-100 text-gray-800 border-gray-200",
  
  // Order statuses
  CONFIRMED: "bg-green-100 text-green-800 border-green-200",
  PROCESSING: "bg-blue-100 text-blue-800 border-blue-200",
  SHIPPED: "bg-indigo-100 text-indigo-800 border-indigo-200",
  DELIVERED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELLED: "bg-red-100 text-red-800 border-red-200",
  REFUNDED: "bg-purple-100 text-purple-800 border-purple-200",
  
  // Payment statuses
  SUCCESSFUL: "bg-green-100 text-green-800 border-green-200",
  FAILED: "bg-red-100 text-red-800 border-red-200",
  
  // Shipment statuses
  IN_TRANSIT: "bg-blue-100 text-blue-800 border-blue-200",
  OUT_FOR_DELIVERY: "bg-indigo-100 text-indigo-800 border-indigo-200",
  RETURNED: "bg-orange-100 text-orange-800 border-orange-200",
};

export default function StatusBadge({
  status,
  customStyles,
  size = "sm",
}: StatusBadgeProps) {
  const styles = customStyles || defaultStyles;
  const style = styles[status] || "bg-gray-100 text-gray-800 border-gray-200";
  
  const sizeClasses = size === "sm" 
    ? "px-2 py-0.5 text-xs" 
    : "px-3 py-1 text-sm";

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border ${style} ${sizeClasses}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}