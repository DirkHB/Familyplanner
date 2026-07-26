/** @type {import('next').NextConfig} */
const nextConfig = {
  // Kleines, vorhersagbares Image für den Sliplane-Docker-Build.
  output: "standalone",
  reactStrictMode: true,
  // Datenschutz: keine externen Font-/CDN-Aufrufe. Alles selbst gehostet.
  poweredByHeader: false,
  experimental: {
    // Sanfte, zusammenhängende Seitenwechsel (Abschnitt 7.4).
    viewTransition: true,
  },
};

export default nextConfig;
