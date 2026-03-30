import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KitchenOS Admin",
  description: "Panel de Administración",
  manifest: "/manifest-admin.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KitchenOS Admin",
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <head>
        <link rel="manifest" href="/manifest-admin.json" />
        <link rel="apple-touch-icon" href="/icons/icon-admin-192.png" />
        <meta name="theme-color" content="#2563eb" />
      </head>
      {children}
    </>
  );
}