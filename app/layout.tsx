import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import AppkitProvider from "@/providers/AppkitProvider";
import { ChainProvider } from "@/providers/ChainProvider";
import TronProviderWrapper from "@/providers/TronProviderWrapper";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"]
});


export const metadata: Metadata = {
  title: "GasSaverX",
  description: "Send tokens to multiple addresses and save on gas fees.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${poppins.className} antialiased bg-zinc-950 text-zinc-50`}
      >
        <ChainProvider>
          <TronProviderWrapper>
            <AppkitProvider>{children}</AppkitProvider>
          </TronProviderWrapper>
        </ChainProvider>
      </body>
    </html>
  );
}
