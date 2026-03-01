// scripts/generate-config.js
// Gera config.js a partir das env vars definidas no Netlify
const fs = require("fs");

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("AVISO: SUPABASE_URL ou SUPABASE_ANON_KEY não definida.");
}

const content = `// config.js (gerado automaticamente no build)
window.SUPABASE_URL = "${SUPABASE_URL}";
window.SUPABASE_ANON_KEY = "${SUPABASE_ANON_KEY}";

console.log('✅ Config carregado');
console.log('🔗 URL:', window.SUPABASE_URL);
console.log('🔑 Key:', window.SUPABASE_ANON_KEY ? 'Configurada ✅' : '❌ VAZIA!');
`;

fs.writeFileSync("config.js", content, { encoding: "utf8" });
console.log("✅ config.js gerado com sucesso!");