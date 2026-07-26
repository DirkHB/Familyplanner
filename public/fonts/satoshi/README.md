# Satoshi hier ablegen (2 Minuten)

Satoshi ist von **Fontshare** (kostenlos, Self-Hosting erlaubt), aber kein OFL/npm-Font —
der Egress-Proxy dieser Umgebung blockt den Download. Deshalb läuft die App vorerst mit
**Hanken Grotesk** (OFL) als warmem Platzhalter für den Body-Text.

## So aktivierst du das echte Satoshi

1. Öffne https://www.fontshare.com/fonts/satoshi und klicke **Download**.
2. Entpacke das ZIP. Nimm die **Variable**-Datei:
   `Satoshi_Complete/Fonts/WEB/fonts/Satoshi-Variable.woff2`
3. Lege sie genau hier ab:
   `public/fonts/satoshi/Satoshi-Variable.woff2`
4. Fertig. Die `@font-face`-Regel in `src/app/globals.css` greift automatisch,
   der Body-Text nutzt ab dem nächsten Build Satoshi statt Hanken Grotesk.

Optional (Boska + Switzer für die dritte Font-Paarung) analog nach
`public/fonts/boska/` bzw. `public/fonts/switzer/` — sag Bescheid, dann verdrahte ich sie.
