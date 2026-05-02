import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import * as tsj from "ts-json-schema-generator";
import Ajv from "ajv";

/**
 * Local test: use the local arkham.ts instead of fetching from GitHub.
 * This proves the updated interface matches the ArkhamDB API.
 */
async function main() {
  const localTsPath = path.resolve(__dirname, "../../dependencies/arkhamdle/src/types/arkham.ts");

  console.log(`Using local arkham.ts: ${localTsPath}`);
  if (!fs.existsSync(localTsPath)) {
    console.error("Local arkham.ts not found!");
    process.exit(1);
  }

  console.log("Generating JSON Schema for ArkhamCard interface...");
  const config = {
    path: localTsPath,
    type: "ArkhamCard",
    additionalProperties: false,
  };
  const schema = tsj.createGenerator(config).createSchema(config.type);

  const ajv = new Ajv({ strict: false, allowUnionTypes: true, allErrors: true });
  const validate = ajv.compile(schema);

  console.log("Fetching ArkhamDB cards...");
  const dbRes = await axios.get("https://arkhamdb.com/api/public/cards/?encounter=1");
  const cards = dbRes.data;

  console.log(`Fetched ${cards.length} cards. Validating...`);

  let criticalErrors: any[] = [];
  let warningCount = 0;
  const additionalPropertiesFound = new Set<string>();

  for (const card of cards) {
    const valid = validate(card);
    if (!valid && validate.errors) {
      for (const err of validate.errors) {
        if (err.keyword === "additionalProperties") {
          const prop = err.params.additionalProperty;
          additionalPropertiesFound.add(prop);
          warningCount++;
        } else {
          criticalErrors.push({
            cardCode: card.code,
            cardName: card.name,
            error: err,
          });
        }
      }
    }
  }

  if (additionalPropertiesFound.size > 0) {
    console.warn(`\nWARNING: Found ${warningCount} instances of additional properties.`);
    console.warn("New properties from ArkhamDB:", Array.from(additionalPropertiesFound));
  }

  if (criticalErrors.length > 0) {
    console.error(`\nCRITICAL: Found ${criticalErrors.length} critical validation errors.`);
    const sampleErrors = criticalErrors.slice(0, 10);
    console.error("Sample critical errors:", JSON.stringify(sampleErrors, null, 2));
    process.exit(1);
  }

  console.log("\n✅ Validation successful! No critical errors found.");
}

main().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
