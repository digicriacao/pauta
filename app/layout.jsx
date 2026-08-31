import "./globals.css";

/**
 * O endereço público completo. O OG precisa de URL absoluta — o robô do
 * WhatsApp, do Slack e do LinkedIn não resolve caminho relativo. Dá para
 * trocar sem mexer aqui, criando o secret NEXT_PUBLIC_SITE_URL no GitHub.
 */
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://digicriacao.github.io/pauta").replace(/\/+$/, "");
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

const TITULO = "Pauta · Digi";
const RESUMO =
  "A pauta de criação da Digi em tempo real: o que entrou, quem está tocando, " +
  "quanto esforço tem no dia e o que sai hoje. Espelha o Azure DevOps e complementa o que ele não guarda.";

export const metadata = {
  metadataBase: new URL(SITE),
  title: TITULO,
  description: RESUMO,
  applicationName: "Pauta",
  openGraph: {
    type: "website",
    siteName: "Pauta · Digi",
    title: TITULO,
    description: RESUMO,
    url: SITE,
    locale: "pt_BR",
    images: [{ url: `${SITE}/pauta_og.jpg`, width: 1200, height: 630, alt: "Pauta da Digi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: RESUMO,
    images: [`${SITE}/pauta_og.jpg`],
  },
  icons: {
    icon: [{ url: `${BASE}/favicon.svg`, type: "image/svg+xml" }],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F4F6" },
    { media: "(prefers-color-scheme: dark)", color: "#0C0C0E" },
  ],
};

/**
 * Favicon que pisca. Navegador nenhum anima SVG em favicon, então quem anima é
 * o próprio JavaScript: troca o `href` do link a cada 900ms entre a bolinha
 * rosa cheia e a branca com aro rosa — a branca sozinha some numa aba clara.
 * O SVG estático em /favicon.svg é o que aparece antes disso rodar.
 */
const PISCA = `
try{
  var l = document.querySelector("link[rel~='icon']");
  if(!l){ l = document.createElement("link"); l.rel = "icon"; document.head.appendChild(l); }
  l.type = "image/svg+xml";
  var aceso = true;
  var svg = function(fill, stroke){
    return "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>"
      + "<circle cx='16' cy='16' r='10' fill='" + fill + "' stroke='" + stroke + "' stroke-width='4'/></svg>";
  };
  var pinta = function(){
    l.href = aceso ? svg("%23EA0356","none") : svg("%23FFFFFF","%23EA0356");
    aceso = !aceso;
  };
  pinta();
  setInterval(pinta, 900);
}catch(e){}
`;

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Aplica o tema salvo antes da primeira pintura, senão a tela pisca. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("pauta.v2.tema");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}`,
          }}
        />
        <script dangerouslySetInnerHTML={{ __html: PISCA }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
