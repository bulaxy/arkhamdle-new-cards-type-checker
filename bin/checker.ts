#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { CheckerStack } from "../lib/checker-stack";

const app = new cdk.App();
new CheckerStack(app, "CheckerStack", {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "ap-southeast-2" },
});
