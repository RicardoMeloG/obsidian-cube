import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as budgets from 'aws-cdk-lib/aws-budgets'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions'
import { join } from 'node:path'

export interface CostGuardProps extends cdk.StackProps {
  /** The site's distribution, the only resource the switch may touch. */
  distributionId: string
  /** Monthly ceiling in USD where the switch fires (spec 014: 20). */
  limitUsd: number
  /** Optional email for the same alert; passed at deploy time, never committed (D-5). */
  alertEmail?: string
}

// Layer 3 of spec 014: a monthly cost budget publishes to SNS when the actual
// spend passes the limit, and a function disables the site's distribution.
// Disabling keeps every setting; turning the site on again is one command
// (docs/deploy-aws.md). Its own stack, so the site's stack is never touched.
export class CostGuardStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CostGuardProps) {
    super(scope, id, props)
    if (!/^E[A-Z0-9]{8,}$/.test(props.distributionId)) throw new Error(`CostGuard: "${props.distributionId}" is not a distribution id`)
    if (!(props.limitUsd > 0)) throw new Error('CostGuard: the limit must be a positive amount')

    const topic = new sns.Topic(this, 'BudgetAlarm', { displayName: 'Obsidian Cube cost ceiling' })
    // Only the budgets service, acting for this account, may publish.
    topic.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'BudgetsPublishOnly',
        principals: [new iam.ServicePrincipal('budgets.amazonaws.com')],
        actions: ['sns:Publish'],
        resources: [topic.topicArn],
        conditions: { StringEquals: { 'aws:SourceAccount': this.account } },
      }),
    )

    const logGroup = new logs.LogGroup(this, 'KillSwitchLogs', {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    const killSwitch = new lambda.Function(this, 'KillSwitch', {
      description: 'Disables the site distribution when the monthly cost ceiling is passed (spec 014)',
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(join(__dirname, '..', 'lambda', 'kill-switch')),
      timeout: cdk.Duration.seconds(30),
      memorySize: 128,
      reservedConcurrentExecutions: 1,
      logGroup,
      environment: { DISTRIBUTION_ID: props.distributionId },
    })
    killSwitch.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['cloudfront:GetDistributionConfig', 'cloudfront:UpdateDistribution'],
        resources: [`arn:aws:cloudfront::${this.account}:distribution/${props.distributionId}`],
      }),
    )
    topic.addSubscription(new subscriptions.LambdaSubscription(killSwitch))

    const subscribers: budgets.CfnBudget.SubscriberProperty[] = [{ subscriptionType: 'SNS', address: topic.topicArn }]
    if (props.alertEmail) subscribers.push({ subscriptionType: 'EMAIL', address: props.alertEmail })

    const budget = new budgets.CfnBudget(this, 'CostCeiling', {
      budget: {
        budgetName: `obsidian-cube-kill-switch-${props.limitUsd}usd`,
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: props.limitUsd, unit: 'USD' },
      },
      notificationsWithSubscribers: [
        {
          notification: { notificationType: 'ACTUAL', comparisonOperator: 'GREATER_THAN', threshold: 100, thresholdType: 'PERCENTAGE' },
          subscribers,
        },
      ],
    })
    budget.node.addDependency(topic)

    new cdk.CfnOutput(this, 'KillSwitchFunction', { value: killSwitch.functionName })
    new cdk.CfnOutput(this, 'BudgetTopic', { value: topic.topicArn })
  }
}
