import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sésame — Comptes & habilitations",
  description:
    "Gestion des entrées, sorties et modifications de comptes de la collectivité",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} h-full antialiased`}>
      {/* suppressHydrationWarning : les extensions navigateur (gestionnaires de
          mots de passe, antivirus) modifient le DOM avant React — bénin */}
      <body className="min-h-full font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
