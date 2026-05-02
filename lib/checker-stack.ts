import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as path from "path";

export class CheckerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const checkerLambda = new lambdaNodejs.NodejsFunction(this, "CheckerLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, "../lambda/checker/index.ts"),
      handler: "handler",
      timeout: cdk.Duration.minutes(3),
      memorySize: 1024, // Needs memory for ts-json-schema-generator
      environment: {
        WEBHOOK_URL: process.env.WEBHOOK_URL || "",
      },
      bundling: {
        minify: true,
        sourceMap: true,
        nodeModules: ["ts-json-schema-generator", "typescript", "ajv"], // Pack these directly to avoid esbuild dynamic require issues
      },
    });

    const rule = new events.Rule(this, "WeeklyCheckerRule", {
      schedule: events.Schedule.cron({ minute: "0", hour: "6", weekDay: "SUN" }),
    });

    rule.addTarget(new targets.LambdaFunction(checkerLambda));
  }
}
