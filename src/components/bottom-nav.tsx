"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", icon: "HOME", label: "HOME" },
  { href: "/scene/airport", icon: "AIR", label: "AIRPORT" },
  { href: "/scene/hotel", icon: "HOTEL", label: "HOTEL" },
  { href: "/scene/izakaya", icon: "FOOD", label: "IZAKAYA" },
  { href: "/scene/shopping", icon: "SHOP", label: "SHOP" }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" aria-label="Primary">
      <div className="bottom-nav-inner">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`bottom-nav-item ${active ? "active" : ""}`.trim()}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
