import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

interface LeadRow {
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  source: string;
  organization_id: string;
}

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  duplicates: number;
  errors: Array<{ row: number; error: string }>;
}

async function parseCSV(filePath: string): Promise<LeadRow[]> {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim());

  const leads: LeadRow[] = [];
  const emailsSeen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const match = line.match(
      /^\*\*(.+?)\*\*\s*\|\s*(.+?)\s*\|\s*phone:\s*(.+?)(?:\s*\|\s*address:\s*(.+))?$/
    );
    if (!match) continue;

    const [, fullName, email, phone, address] = match;
    const cleanEmail = email?.trim() || null;

    if (cleanEmail && emailsSeen.has(cleanEmail)) {
      continue;
    }

    if (cleanEmail) emailsSeen.add(cleanEmail);

    leads.push({
      full_name: fullName.trim(),
      email: cleanEmail,
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      source: "CUCICBA",
      organization_id: process.env.MELANO_ORG_ID || "",
    });
  }

  return leads;
}

async function importLeads(
  filePath: string,
  organizationId: string
): Promise<ImportResult> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("📂 Parsing CSV...");
  const leads = await parseCSV(filePath);

  console.log(`✅ Parsed ${leads.length} leads (after deduplication)`);

  const result: ImportResult = {
    total: leads.length,
    success: 0,
    failed: 0,
    duplicates: 0,
    errors: [],
  };

  console.log("🔄 Inserting leads into Supabase...");

  const batchSize = 100;
  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize).map((lead) => ({
      ...lead,
      organization_id: organizationId,
      cohort: "LUXIA",
      source: "CUCICBA",
      phase: "FASE_0_14",
      status: "NUEVO",
      score: 0,
      is_demo: false,
    }));

    const { data, error } = await supabase
      .from("leads")
      .insert(batch)
      .select("id");

    if (error) {
      console.error(`❌ Batch ${i / batchSize + 1} failed:`, error.message);
      result.failed += batch.length;
      result.errors.push({
        row: i,
        error: error.message,
      });
    } else {
      result.success += data?.length || 0;
      console.log(
        `✅ Batch ${i / batchSize + 1}: ${data?.length || 0} leads inserted`
      );
    }
  }

  return result;
}

async function main() {
  const csvPath = process.argv[2];
  const orgId = process.argv[3] || process.env.MELANO_ORG_ID;

  if (!csvPath) {
    console.error("Usage: npx tsx scripts/import-leads.ts <csv-path> [org-id]");
    process.exit(1);
  }

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ File not found: ${csvPath}`);
    process.exit(1);
  }

  if (!orgId) {
    console.error("❌ Missing organization ID. Set MELANO_ORG_ID env var");
    process.exit(1);
  }

  console.log(`📥 Importing leads from: ${csvPath}`);
  console.log(`🏢 Organization ID: ${orgId}\n`);

  const result = await importLeads(csvPath, orgId);

  console.log("\n📊 IMPORT SUMMARY");
  console.log("─".repeat(50));
  console.log(`Total:      ${result.total}`);
  console.log(`Success:    ${result.success} ✅`);
  console.log(`Failed:     ${result.failed} ❌`);
  console.log(`Duplicates: ${result.duplicates} ⚠️`);

  if (result.errors.length > 0) {
    console.log("\n⚠️  ERRORS:");
    result.errors.forEach(({ row, error }) => {
      console.log(`  Row ${row}: ${error}`);
    });
  }

  console.log("─".repeat(50));
  process.exit(result.failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
