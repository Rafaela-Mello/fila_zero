import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_MENU_DIR = path.join(__dirname, "../../uploads/menu");
const BUCKET = process.env.SUPABASE_MENU_BUCKET || "menu";

let supabase;

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!supabase) supabase = createClient(url, key);
  return supabase;
}

/**
 * Salva foto do cardápio.
 * Na Vercel usa Supabase Storage; em local pode gravar em disco se Storage não estiver configurado.
 */
export async function saveMenuPhoto({ buffer, mime, filename }) {
  const client = getSupabase();

  if (client) {
    const objectPath = `menu/${filename}`;
    const { error } = await client.storage.from(BUCKET).upload(objectPath, buffer, {
      contentType: mime,
      upsert: false,
    });
    if (error) throw new Error(error.message);

    const { data } = client.storage.from(BUCKET).getPublicUrl(objectPath);
    return data.publicUrl;
  }

  if (process.env.VERCEL) {
    throw new Error(
      "Configure SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY e um bucket público 'menu' no Supabase Storage."
    );
  }

  fs.mkdirSync(LOCAL_MENU_DIR, { recursive: true });
  fs.writeFileSync(path.join(LOCAL_MENU_DIR, filename), buffer);
  return `/uploads/menu/${filename}`;
}
