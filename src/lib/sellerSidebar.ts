export interface SidebarItem {
  label: string;
  href?: string;
  iconName: string;
  badge?: number | string;
  highlight?: boolean;
  children?: SidebarItem[];
}

export const sellerSidebarItems: SidebarItem[] = [
  {
    label: "Overview",
    href: "/seller",
    iconName: "LayoutDashboard",
  },
  {
    label: "Sales & Customers",
    iconName: "ShoppingBag",
    children: [
      { label: "Orders", href: "/seller/orders", iconName: "ShoppingCart" },
      { label: "Inbox", href: "/seller/inbox", iconName: "MessageCircle" },
      { label: "Reviews", href: "/seller/reviews", iconName: "Star" },
      { label: "Discounts", href: "/seller/discounts", iconName: "Tag" },
    ],
  },
  {
    label: "Products & Inventory",
    iconName: "Package",
    children: [
      { label: "Products", href: "/seller/products", iconName: "Package" },
      { label: "Stocking", href: "/seller/stocking", iconName: "PackagePlus" },
      { label: "Inventory", href: "/seller/inventory", iconName: "Boxes" },
      { label: "Bulk Import", href: "/seller/import", iconName: "Upload", highlight: true },
    ],
  },
  {
    label: "Business & Finance",
    iconName: "ChartNoAxesCombined",
    children: [
      { label: "Finances", href: "/seller/finances", iconName: "DollarSign" },
      { label: "Analytics", href: "/seller/analytics", iconName: "TrendingUp" },
    ],
  },
  {
    label: "Store Management",
    iconName: "Store",
    children: [
      { label: "Notifications", href: "/seller/notifications", iconName: "Bell" },
      { label: "Staff", href: "/seller/settings/staff", iconName: "Users" },
      { label: "Settings", href: "/seller/settings", iconName: "Settings" },
    ],
  },
];
