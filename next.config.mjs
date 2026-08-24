/**
 * Site estático, publicado no GitHub Pages.
 *
 * `output: "export"` faz o Next gerar HTML/CSS/JS puros na pasta `out/` —
 * sem servidor. Quem faz o trabalho de servidor são as Edge Functions do
 * Supabase (pasta supabase/functions), onde o AZURE_PAT fica guardado.
 *
 * O basePath é o nome do repositório, porque o Pages publica em
 * https://USUARIO.github.io/NOME-DO-REPO/ — o workflow preenche isso sozinho.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
