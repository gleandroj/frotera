import * as fs from "fs";
import * as path from "path";
import OpenAI from "openai";

// Configuração
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SOURCE_FILE = path.join(__dirname, "../apps/web/i18n/locales/en.json");
const LOCALES_DIR = path.join(__dirname, "../apps/web/i18n/locales");

// Mapeamento de códigos de idioma para nomes completos
const LANGUAGE_NAMES: Record<string, string> = {
  es: "Spanish",
  de: "German",
  pt: "Portuguese",
  fr: "French",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ru: "Russian",
  ar: "Arabic",
};

// Inicializar cliente OpenAI
if (!OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY não encontrada. Configure a variável de ambiente.");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

/**
 * Divide um objeto JSON em blocos menores mantendo a estrutura
 */
function splitIntoChunks(obj: any, maxDepth: number = 2, currentDepth: number = 0): any[] {
  const chunks: any[] = [];

  if (currentDepth >= maxDepth || typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return [obj];
  }

  const keys = Object.keys(obj);
  const chunkSize = Math.ceil(keys.length / Math.ceil(keys.length / 10)); // Divide em ~10 chunks

  for (let i = 0; i < keys.length; i += chunkSize) {
    const chunk: any = {};
    const chunkKeys = keys.slice(i, i + chunkSize);

    for (const key of chunkKeys) {
      chunk[key] = obj[key];
    }

    chunks.push(chunk);
  }

  return chunks;
}

/**
 * Divide o JSON em blocos menores baseado no tamanho aproximado
 */
function createTranslationChunks(data: any, maxSize: number = 3000): any[] {
  const chunks: any[] = [];
  const keys = Object.keys(data);

  let currentChunk: any = {};
  let currentSize = 0;

  for (const key of keys) {
    const value = data[key];
    // Calcula o tamanho aproximado do objeto incluindo a chave
    const keySize = JSON.stringify({ [key]: value }).length;

    // Se adicionar esta chave exceder o limite E já temos chaves no chunk atual
    if (currentSize + keySize > maxSize && Object.keys(currentChunk).length > 0) {
      chunks.push(currentChunk);
      currentChunk = {};
      currentSize = 0;
    }

    currentChunk[key] = value;
    currentSize += keySize;
  }

  // Adiciona o último chunk se não estiver vazio
  if (Object.keys(currentChunk).length > 0) {
    chunks.push(currentChunk);
  }

  return chunks.length > 0 ? chunks : [data];
}

/**
 * Traduz um bloco de JSON usando OpenAI
 */
async function translateChunk(
  chunk: any,
  targetLanguage: string,
  languageName: string
): Promise<any> {
  const prompt = `You are a professional translator. Translate the following JSON object to ${languageName}.

IMPORTANT RULES:
1. Only translate the VALUES (strings), never translate the KEYS
2. Maintain the exact JSON structure
3. Keep all placeholders like {{variableName}} unchanged
4. Preserve all special characters, HTML tags, and formatting
5. Return ONLY valid JSON, no explanations or markdown
6. Maintain the same data types (strings, numbers, booleans, arrays, objects)

JSON to translate:
${JSON.stringify(chunk, null, 2)}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional translator specializing in software localization. You translate JSON translation files while preserving all technical elements. Always return valid JSON only, no markdown, no explanations.`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
    });

    const translatedText = response.choices[0]?.message?.content;
    if (!translatedText) {
      throw new Error("Resposta vazia da API");
    }

    // Tenta extrair JSON se vier com markdown
    let jsonText = translatedText.trim();

    // Remove markdown code blocks se presente
    if (jsonText.includes("```")) {
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonText = jsonMatch[1].trim();
      } else {
        // Tenta remover apenas os delimitadores
        jsonText = jsonText.replace(/^```json\n?/i, "").replace(/\n?```$/i, "");
        jsonText = jsonText.replace(/^```\n?/, "").replace(/\n?```$/, "");
      }
    }

    // Tenta encontrar JSON válido mesmo se houver texto antes/depois
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    try {
      const translated = JSON.parse(jsonText);
      return translated;
    } catch (parseError: any) {
      console.error("JSON recebido:", jsonText.substring(0, 500));
      throw new Error(`Erro ao fazer parse do JSON: ${parseError.message}`);
    }
  } catch (error: any) {
    console.error(`❌ Erro ao traduzir bloco:`, error.message);
    throw error;
  }
}

/**
 * Mescla chunks traduzidos em um único objeto
 */
function mergeChunks(chunks: any[]): any {
  const merged: any = {};

  for (const chunk of chunks) {
    Object.assign(merged, chunk);
  }

  return merged;
}

/**
 * Função principal de tradução
 */
async function translateFile(targetLanguage: string): Promise<void> {
  const languageName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;

  console.log(`\n🌍 Iniciando tradução para ${languageName} (${targetLanguage})...\n`);

  // 1. Ler arquivo fonte
  console.log("📖 Lendo arquivo fonte...");
  if (!fs.existsSync(SOURCE_FILE)) {
    throw new Error(`Arquivo não encontrado: ${SOURCE_FILE}`);
  }

  const sourceContent = fs.readFileSync(SOURCE_FILE, "utf-8");
  const sourceData = JSON.parse(sourceContent);
  console.log(`✅ Arquivo lido com sucesso (${Object.keys(sourceData).length} chaves principais)\n`);

  // 2. Dividir em chunks
  console.log("✂️  Dividindo em blocos para tradução...");
  const chunks = createTranslationChunks(sourceData, 3000);
  console.log(`✅ Dividido em ${chunks.length} blocos\n`);

  // 3. Traduzir cada chunk
  console.log("🔄 Traduzindo blocos...\n");
  const translatedChunks: any[] = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`   Traduzindo bloco ${i + 1}/${chunks.length}...`);
    try {
      const translated = await translateChunk(chunks[i], targetLanguage, languageName);
      translatedChunks.push(translated);
      console.log(`   ✅ Bloco ${i + 1} traduzido com sucesso\n`);

      // Pequeno delay para evitar rate limiting
      if (i < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error: any) {
      console.error(`   ❌ Erro no bloco ${i + 1}:`, error.message);
      throw error;
    }
  }

  // 4. Mesclar chunks
  console.log("🔗 Mesclando blocos traduzidos...");
  const translatedData = mergeChunks(translatedChunks);
  console.log("✅ Blocos mesclados com sucesso\n");

  // 5. Salvar arquivo traduzido
  const outputFile = path.join(LOCALES_DIR, `${targetLanguage}.json`);
  console.log(`💾 Salvando arquivo traduzido em ${outputFile}...`);

  fs.writeFileSync(
    outputFile,
    JSON.stringify(translatedData, null, 2) + "\n",
    "utf-8"
  );

  console.log(`✅ Arquivo traduzido salvo com sucesso!\n`);
  console.log(`📊 Estatísticas:`);
  console.log(`   - Chaves traduzidas: ${Object.keys(translatedData).length}`);
  console.log(`   - Blocos processados: ${chunks.length}`);
  console.log(`   - Arquivo de saída: ${outputFile}\n`);
}

// Executar script
async function main() {
  const targetLanguage = process.argv[2];

  if (!targetLanguage) {
    console.error("❌ Uso: tsx scripts/translate-i18n.ts <código-do-idioma>");
    console.error("   Exemplo: tsx scripts/translate-i18n.ts es");
    console.error("   Exemplo: tsx scripts/translate-i18n.ts de");
    console.error("\n   Idiomas suportados:", Object.keys(LANGUAGE_NAMES).join(", "));
    process.exit(1);
  }

  if (!LANGUAGE_NAMES[targetLanguage]) {
    console.warn(`⚠️  Idioma "${targetLanguage}" não está no mapeamento, mas será usado mesmo assim.`);
  }

  try {
    await translateFile(targetLanguage);
    console.log("🎉 Tradução concluída com sucesso!\n");
  } catch (error: any) {
    console.error("\n❌ Erro durante a tradução:", error.message);
    process.exit(1);
  }
}

main();
