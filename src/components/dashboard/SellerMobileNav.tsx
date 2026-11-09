"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  PackagePlus,
  Package,
  ShoppingCart,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";

const navigation: {
  label: string;
  href: string;
  icon: LucideIcon;
}[] = [
  { label: "Home", href: "/seller", icon: Home },
  { label: "Products", href: "/seller/products", icon: Package },
  { label: "Orders", href: "/seller/orders", icon: ShoppingCart },
  { label: "Inbox", href: "/seller/inbox", icon: MessageCircle },
  { label: "Stocking", href: "/seller/stocking", icon: PackagePlus },
];

export default function SellerMobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Seller navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-lg lg:hidden"
    >
      <div className="mx-auto grid min-h-16 max-w-lg grid-cols-5">
        {navigation.map(({ label, href, icon: Icon }) => {
          const active =
            href === "/seller"
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium transition-colors ${
                active
                  ? "text-teal-700"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <Icon
                className={`h-5 w-5 ${
                  active ? "stroke-[2.5]" : "stroke-2"
                }`}
              />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
