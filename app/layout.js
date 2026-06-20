import "./globals.css";

export const metadata = {
  title: "Pixie Productions — Training Console",
  description: "Internal training session management",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
