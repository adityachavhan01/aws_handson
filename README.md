# AWS Hands‑On — expense-tracker (aws\_handson)

This repository contains AWS infrastructure code (AWS CDK + CloudFormation templates) that demonstrates how to build a private networking baseline and run stateful container services (MySQL, Zookeeper, Kafka) on ECS Fargate behind an internal Network Load Balancer. It is meant as a hands‑on lab / PoC for learning VPC design, ECS Fargate task definitions, service discovery, NLB target groups and CloudWatch logging.

---

## Project overview

This project provisions:

* A custom VPC with public and private subnets (multi‑AZ) and NAT gateways
* Security group(s) and a custom Network ACL
* An internal Network Load Balancer (NLB) and target groups for TCP services
* An ECS Cluster (Fargate)
* Fargate Task Definitions & Services for:

  * MySQL (single replica)
  * Zookeeper (3 replicas)
  * Kafka (3 replicas)
* CloudWatch Log Groups for container logs
* Service Discovery (AWS Cloud Map) for internal DNS names

Use this repository to learn how a containerized stateful stack can be composed on AWS using CDK and CloudFormation. The code contains both TypeScript CDK stacks and CloudFormation YAML for comparison / reference.

---

## Architecture (high level)

1. Custom VPC across 2 AZs (2 public + 2 private subnets)
2. Public subnets host NAT or public ALB/NLB where needed
3. Private subnets host ECS Fargate tasks (MySQL/Kafka/Zookeeper) with no public IPs
4. Internal NLB distributes TCP traffic for MySQL (3306) and Kafka (9092)
5. ECS services register with Cloud Map to provide internal DNS names (e.g., `zookeeper-service.local`)
6. Container logs are sent to CloudWatch Log Groups

---

## Key components & files

* `lib/expense-tracker-services.ts` (CDK stack)

  * `ExpenseTrackerServices` — defines cluster, task defs, services, NLB and SSM output
* `lib/network-stack.ts` (CDK stack)

  * `NetworkStack` — custom VPC, NAT gateways, security groups, NACLs and outputs
* `template/` or `cloudformation.yml` (CloudFormation templates)

  * Example CloudFormation template for VPC, ALB, ECS cluster, tasks and services
* `package.json`, `cdk.json` — CDK project metadata

> Note: file names above are representative — check your repo layout for exact paths.

---

## Prerequisites

* Node.js (>= 16 recommended)
* npm or yarn
* AWS CLI configured with credentials and a default region
* AWS CDK (v2) installed globally: `npm install -g aws-cdk` (or use `npx cdk`)
* An SSM parameter store or values for VPC and subnets if importing an existing VPC

---

## Local setup

1. Clone the repo

```bash
git clone <repo-url>
cd aws_handson
```

2. Install dependencies

```bash
npm install
# or
# yarn install
```

3. (Optional) Build the TypeScript if your CDK project uses it

```bash
npm run build
```

---

## Deploying with CDK (recommended for this repo)

1. Bootstrap your environment (only first time per account/region):

```bash
cdk bootstrap aws://<ACCOUNT_ID>/<REGION>
```

2. Synthesize to verify templates:

```bash
cdk synth
```

3. Deploy stacks (example):

```bash
# Deploy network stack first
cdk deploy NetworkStack

# If ExpenseTrackerServices depends on SSM outputs from the network stack, deploy it next
cdk deploy ExpenseTrackerServices
```

Notes:

* Replace `NetworkStack` and `ExpenseTrackerServices` with the actual stack IDs defined in your `bin` entrypoint.
* Monitor the CloudFormation console for detailed progress and possible failures.

---

## Required parameters / SSM keys

**Used by `ExpenseTrackerServices` CDK stack**

* `VpcId` — SSM parameter that contains the VPC ID to import
* `PrivateSubnet-0` — Subnet ID for private subnet (AZ 1)
* `PrivateSubnet-1` — Subnet ID for private subnet (AZ 2)

The stack writes back a parameter named `ExpenseTrackerServicesNLB` containing the NLB DNS name.

**CloudFormation template parameters (if using CFN directly)**

* `VPC`, `PublicSubnets`, `PrivateSubnets` (IDs)
* `InstanceType`, `AMI` (for EC2-backed parts)
* `MySQLRootPassword`, `MySQLUser`, `MySQLPassword` (sensitive — NoEcho used in CFN)
* `KafkaAdvertisedListeners`, `ECSClusterName`, `PublicLoadBalancer`, `PublicLoadBalancerSg`, `VPCCIDR`

> Tip: To create SSM parameters use the AWS CLI, e.g.:

```bash
aws ssm put-parameter --name VpcId --value vpc-0123456789abcdef0 --type String --overwrite
aws ssm put-parameter --name PrivateSubnet-0 --value subnet-0aaa... --type String --overwrite
aws ssm put-parameter --name PrivateSubnet-1 --value subnet-0bbb... --type String --overwrite
```

---

## Useful commands

* `cdk synth` — view generated CloudFormation
* `cdk diff` — compare local changes to deployed stack
* `cdk deploy <StackName>` — deploy a stack
* `cdk destroy <StackName>` — remove a deployed stack
* `aws ssm get-parameter --name ExpenseTrackerServicesNLB --with-decryption` — read the NLB DNS


---

## Troubleshooting

* **Task fails to start** — check CloudWatch logs for the task; ensure subnets/security groups allow required network traffic (ECR, SSM, CloudWatch endpoints)
* **Service can't reach Zookeeper/Kafka** — validate Cloud Map names (e.g., `zookeeper-service.local`) and DNS resolution inside the cluster
* **NLB DNS name unreachable** — remember the NLB is internal (internetFacing: false). You must be inside the VPC (bastion, VPN, or VPC peering) to reach it.
* **Permissions issues** — ensure the CDK execution role / CLI user has CloudFormation, IAM, EC2, ECS, ECR, Logs, SSM permissions

---

## Cleanup

Remove deployed resources to avoid charges:

```bash
# If using CDK
cdk destroy ExpenseTrackerServices
cdk destroy NetworkStack

# If you created SSM parameters and want to remove them manually
aws ssm delete-parameter --name VpcId
aws ssm delete-parameter --name PrivateSubnet-0
aws ssm delete-parameter --name PrivateSubnet-1
```

---

## Security considerations

* Never store secrets in plain text in code or in public repos.
* Use `SecureString` SSM parameters or Secrets Manager for DB credentials.
* Limit IAM policies to least privilege for the CDK deploy user/role.
* Restrict Security Group ingress to specific CIDRs where possible.

---



