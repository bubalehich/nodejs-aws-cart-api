import * as cdk from 'aws-cdk-lib/core';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

const DB_USER = 'postgres';
const DB_NAME = 'cartdb';
const ROOT = path.resolve(__dirname, '../..');

function buildLambdaAsset(): lambda.AssetCode {
  return lambda.Code.fromAsset(ROOT, {
    assetHashType: cdk.AssetHashType.OUTPUT,
    bundling: {
      image: cdk.DockerImage.fromRegistry('public.ecr.aws/sam/build-nodejs20.x:latest'),
      local: {
        tryBundle(outputDir: string): boolean {
          execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
          execSync(`xcopy /E /I /Y "${path.join(ROOT, 'dist', 'src')}" "${outputDir}"`, { stdio: 'inherit' });
          execSync(`xcopy /E /I /Y "${path.join(ROOT, 'db')}" "${path.join(outputDir, 'db')}"`, { stdio: 'inherit' });
          fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(outputDir, 'package.json'));
          execSync('npm install --omit=dev --legacy-peer-deps --ignore-scripts', {
            cwd: outputDir,
            stdio: 'inherit',
          });
          return true;
        },
      },
      command: [],
    },
  });
}

export class CartServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'CartVpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { name: 'isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });

    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSg', {
      vpc,
      description: 'Allow Lambda to access RDS Postgres',
      allowAllOutbound: false,
    });

    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSg', {
      vpc,
      description: 'Cart Lambda security group',
      allowAllOutbound: true,
    });

    dbSecurityGroup.addIngressRule(lambdaSecurityGroup, ec2.Port.tcp(5432), 'Postgres from Lambda');

    const db = new rds.DatabaseInstance(this, 'CartDb', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSecurityGroup],
      credentials: rds.Credentials.fromGeneratedSecret(DB_USER, {
        secretName: 'cart-service/db-credentials',
      }),
      databaseName: DB_NAME,
      allocatedStorage: 20,
      maxAllocatedStorage: 25,
      publiclyAccessible: false,
      multiAz: false,
      backupRetention: cdk.Duration.days(0),
      deleteAutomatedBackups: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const dbEnv = {
      DB_HOST: db.dbInstanceEndpointAddress,
      DB_PORT: db.dbInstanceEndpointPort,
      DB_NAME,
      DB_USER,
      DB_PASSWORD: db.secret!.secretValueFromJson('password').unsafeUnwrap(),
    };

    const code = buildLambdaAsset();

    const cartApi = new lambda.Function(this, 'CartApiFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      code,
      handler: 'lambda.handler',
      functionName: 'cartApi',
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [lambdaSecurityGroup],
      environment: { ...dbEnv, NODE_OPTIONS: '--enable-source-maps' },
    });

    const seeder = new lambda.Function(this, 'DbSeederFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      code,
      handler: 'seeder.handler',
      functionName: 'cartDbSeeder',
      timeout: cdk.Duration.minutes(2),
      memorySize: 512,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [lambdaSecurityGroup],
      environment: dbEnv,
    });

    const api = new apigateway.RestApi(this, 'CartServiceApi', {
      restApiName: 'Cart Service',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['*'],
      },
      binaryMediaTypes: ['*/*'],
    });

    api.root.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(cartApi),
      anyMethod: true,
    });

    new cdk.CfnOutput(this, 'CartApiUrl', { value: api.url });
    new cdk.CfnOutput(this, 'DbEndpoint', { value: db.dbInstanceEndpointAddress });
    new cdk.CfnOutput(this, 'SeederFunctionName', { value: seeder.functionName });
  }
}
