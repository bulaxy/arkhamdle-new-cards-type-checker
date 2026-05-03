# Arkhamdle New Cards Type Checker

A serverless validation system that monitors [Arkhamdle](https://github.com/bulaxy/arkhamdle) for schema changes in the ArkhamDB API.

## What This Does

This project runs a **weekly scheduled Lambda function** that:

1. **Fetches** the `ArkhamCard` type definition from the [Arkhamdle](https://github.com/bulaxy/arkhamdle) repository
2. **Generates** a JSON schema from the TypeScript type
3. **Validates** all cards from the [ArkhamDB API](https://arkhamdb.com/api/public/cards) against that schema
4. **Detects** two types of issues:
   - **Critical errors**: Schema violations (missing required fields, type mismatches)
   - **Warnings**: New properties added to cards that aren't in the type definition
5. **Notifies** via webhook if critical errors are found

This helps keep the Arkhamdle type definitions in sync with the actual ArkhamDB API, catching breaking changes early.

## Architecture

- **AWS Lambda**: Node.js 24.x runtime, scheduled weekly (Saturday 7:00 AM Melbourne time / Friday 9:00 PM UTC)
- **AWS EventBridge**: Triggers the Lambda on schedule
- **Infrastructure as Code**: AWS CDK (TypeScript)

## Setup

### Prerequisites

- Node.js 24.x (see `.nvmrc`)
- AWS credentials configured
- A webhook URL for notifications (Discord, Slack, or custom endpoint)

### Installation

```bash
npm install
npm run build
```

### Deployment

```bash
export WEBHOOK_URL="your-webhook-url-here"
npx cdk deploy
```

## Project Status

⚠️ **Vibed-coded project**: This is a quick, purpose-built solution tightly coupled with [Arkhamdle](https://github.com/bulaxy/arkhamdle). Changes to the ArkhamCard type definition or ArkhamDB API structure will directly affect this checker.

## Scripts

- `npm run build` - Compile TypeScript
- `npm run lint` - Run ESLint
- `npm run cdk` - Run AWS CDK commands

## Cost

This should fit comfortably within AWS's free tier (~$0/month):

- ~5 Lambda invocations per month
- ~50 seconds of compute time monthly
- Minimal data transfer
