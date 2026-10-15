import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: { default: "ভূমি দলিল যাচাই ও নিবন্ধন", template: "%s · Land Deed System" },
  description: "Land deed verification and registration support system (development build).",
};

export default function RootLayout({ children }) {
  return (
    <html lang="bn">
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">মূল অংশে যান</a>
        <Header />
        <main id="main" className="container-page flex-1 py-8">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
