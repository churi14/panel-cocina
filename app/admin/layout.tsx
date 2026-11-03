import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "La Cocina · Admin",
  description: "Panel de Administración",
  manifest: "/manifest-admin.json",
  icons: { apple: "/icons/icon-admin-192.png" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "La Cocina · Admin",
  },
};

export const viewport: Viewport = {
  themeColor: "#3a57e8",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
