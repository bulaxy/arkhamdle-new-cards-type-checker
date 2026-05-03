import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import * as tsj from "ts-json-schema-generator";
import Ajv from "ajv";

const ARKHAM_TS_URL =
  "https://raw.githubusercontent.com/bulaxy/arkhamdle/master/src/types/arkham.ts";
const ARKHAM_DB_API = "https://arkhamdb.com/api/public/cards/?encounter=1";

// Known issues that should not trigger warnings, they are not useful field in my arkhamdle implementation, but are present in arkhamdb and not in arkham.ts, so we ignore them for now. This allows us to focus on truly new fields that might indicate a breaking change.
const KNOWN_ISSUES = new Set<string>([
  "spoiler",
  "tag",
  "atleast",
  "uses",
  "text",
  "name",
  "faction_select",
  "type",
  "deck_size_select",
  "slot",
  "option_select",
  "id",
  "base_level",
  "ignore_match",
  "permanent", // This is used, already added in the important spot
]);

export const handler = async (event: any) => {
  console.log("Starting Arkhamdle Checker execution.");

  try {
    // 1. Fetch arkham.ts
    console.log(`Fetching arkham.ts from ${ARKHAM_TS_URL}`);
    const tsRes = await axios.get(ARKHAM_TS_URL);
    const tsContent = tsRes.data;

    // 2. Save it to /tmp
    const tmpTsPath = path.join("/tmp", "arkham.ts");
    fs.writeFileSync(tmpTsPath, tsContent);

    // 3. Generate JSON Schema
    console.log("Generating JSON Schema for ArkhamCard interface...");
    const config = {
      path: tmpTsPath,
      type: "ArkhamCard",
      additionalProperties: false, // We set to false to catch new fields!
    };
    const schema = tsj.createGenerator(config).createSchema(config.type);

    // 4. Initialize Ajv
    const ajv = new Ajv({ strict: false, allowUnionTypes: true, allErrors: true });
    const validate = ajv.compile(schema);

    // 5. Fetch cards
    console.log(`Fetching ArkhamDB cards from ${ARKHAM_DB_API}`);
    const dbRes = await axios.get(ARKHAM_DB_API);
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
            // New property added
            const prop = err.params.additionalProperty;
            // Only track if not in known issues list
            if (!KNOWN_ISSUES.has(prop)) {
              additionalPropertiesFound.add(prop);
              warningCount++;
            }
          } else {
            // Structural error (missing required, wrong type)
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
      console.warn(`WARNING: Found ${warningCount} instances of additional properties.`);
      console.warn("Properties added:", Array.from(additionalPropertiesFound));

      // Notify about warnings without mention
      const webhookUrl = process.env.WEBHOOK_URL;
      if (webhookUrl) {
        console.log(`Sending warning notification to webhook: ${webhookUrl}`);
        await axios
          .post(webhookUrl, {
            content: `⚠️ **Arkhamdle Checker** - Found ${warningCount} instances of additional properties.\n\nProperties: ${Array.from(additionalPropertiesFound).join(", ")}`,
          })
          .catch((err) => console.error("Failed to send webhook:", err.message));
      }
    }

    if (criticalErrors.length > 0) {
      console.error(`CRITICAL: Found ${criticalErrors.length} critical validation errors.`);

      // We will only log the first 10 for brevity in the console and webhook
      const sampleErrors = criticalErrors.slice(0, 10);
      console.error("Sample critical errors:", JSON.stringify(sampleErrors, null, 2));

      // Send error notification to webhook
      const webhookUrl = process.env.WEBHOOK_URL;
      if (webhookUrl) {
        console.log(`Sending failure notification to webhook: ${webhookUrl}`);
        await axios
          .post(webhookUrl, {
            content: `🚨 **Arkhamdle Checker Alert** 🚨\n<@244224402126929920> Validation against ArkhamDB API failed.\n${criticalErrors.length} critical errors found.\n\nSample:\n\`\`\`json\n${JSON.stringify(sampleErrors, null, 2)}\n\`\`\``,
          })
          .catch((err) => console.error("Failed to send webhook:", err.message));
      }

      throw new Error(`Validation failed with ${criticalErrors.length} critical errors.`);
    }

    console.log("Validation successful. No critical errors found.");
    return { statusCode: 200, body: "Success" };
  } catch (error: any) {
    console.error("Execution failed:", error);
    throw error;
  }
};
