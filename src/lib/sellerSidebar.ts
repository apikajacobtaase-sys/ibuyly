 // src/lib/sellerSidebar.ts
export interface SidebarItem {
  label: string;
  href: string;
  iconName: string; // 👈 Must be a string
  badge?: number | string;
  highlight?: boolean;
}

export const sellerSidebarItems: SidebarItem[] = [
  { label: "Overview", href: "/seller", iconName: "LayoutDashboard" },
  { label: "Products", href: "/seller/products", iconName: "Package" },
  { label: "Bulk Import", href: "/seller/import", iconName: "Upload", highlight: true },
  { label: "Inventory", href: "/seller/inventory", iconName: "Boxes" },
  { label: "Orders", href: "/seller/orders", iconName: "ShoppingCart" },
  { label: "Discounts", href: "/seller/discounts", iconName: "Tag" },
  { label: "Finances", href: "/seller/finances", iconName: "DollarSign" },
  { label: "Analytics", href: "/seller/analytics", iconName: "TrendingUp" },
  { label: "Reviews", href: "/seller/reviews", iconName: "Star" },
  { label: "Notifications", href: "/seller/notifications", iconName: "Bell" },
  { label: "Settings", href: "/seller/settings", iconName: "Settings" },
  { label: "Staff", href: "/seller/settings/staff", iconName: "Users" }, 
  {label: "stocking", href:"/seller/stocking", iconName: "stocking"},
];