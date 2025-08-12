// tasks

// Creates a custom VPC with:
// 2 public subnets (multi-AZ)
// 2 private subnets (multi-AZ)

// Adds:
// Internet Gateway (automatically added by CDK)
// NAT Gateway in public subnet for internet access to private subnets

// Configures:
// Security Group for controlled inbound/outbound
// Network ACLs for extra granular control

// Ensures:
// High availability (multi-AZ)
// Isolation (via subnet division and NACLs)

// solution:-
//  1. Custom VPC with Public & Private subnets (2 AZs)
//  2. Security Group with controlled inbound/outbound rules
//  3. Custom Network ACLs
//  Output VPC ID
//  Output Security Group ID

// Deploy Instructions:

// 1) Initialize a CDK app
//     mkdir my-network && cd my-network
//     cdk init app --language=typescript
//     npm install aws-cdk-lib constructs

// 2) Replace lib/my-network-stack.ts with the above code.
// 3) Bootstrap & Deploy:
// cdk bootstrap
// cdk deploy



import * as cdk from 'aws-cdk-lib';
import {
  CfnOutput,
  Stack,
  StackProps,
} from 'aws-cdk-lib';
import {
  Vpc,
  SubnetType,
  NatProvider,
  SecurityGroup,
  Peer,
  Port,
  CfnNetworkAcl,
  CfnNetworkAclEntry,
  CfnSubnetNetworkAclAssociation,
  Subnet
} from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class NetworkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 🔹 NAT Gateway config (1 per AZ)
    const natProvider = NatProvider.gateway();

    // ✅ 1. Custom VPC with Public & Private subnets (2 AZs)
    const vpc = new Vpc(this, 'CustomVPC', {
      maxAzs: 2,
      natGateways: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public-subnet',
          subnetType: SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private-subnet',
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // ✅ 2. Security Group with controlled inbound/outbound rules
    const securityGroup = new SecurityGroup(this, 'InstanceSecurityGroup', {
      vpc,
      allowAllOutbound: false,
      description: 'Security Group for EC2 in private subnet',
    });

    securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(22), 'Allow SSH');
    securityGroup.addEgressRule(Peer.anyIpv4(), Port.tcp(443), 'Allow HTTPS Out');

    // ✅ 3. Custom Network ACLs
    const nacl = new CfnNetworkAcl(this, 'CustomNACL', {
      vpcId: vpc.vpcId,
    });

    // Allow inbound HTTP (port 80)
    new CfnNetworkAclEntry(this, 'InboundHttp', {
      networkAclId: nacl.ref,
      ruleNumber: 100,
      protocol: 6,
      ruleAction: 'allow',
      egress: false,
      cidrBlock: '0.0.0.0/0',
      portRange: { from: 80, to: 80 },
    });

    // Allow outbound HTTPS (port 443)
    new CfnNetworkAclEntry(this, 'OutboundHttps', {
      networkAclId: nacl.ref,
      ruleNumber: 100,
      protocol: 6,
      ruleAction: 'allow',
      egress: true,
      cidrBlock: '0.0.0.0/0',
      portRange: { from: 443, to: 443 },
    });

    // Attach NACL to private subnets
    vpc.privateSubnets.forEach((subnet, index) => {
      new CfnSubnetNetworkAclAssociation(this, `PrivateSubnetAclAssoc${index}`, {
        networkAclId: nacl.ref,
        subnetId: (subnet as Subnet).subnetId,
      });
    });

    // ✅ Output VPC ID
    new CfnOutput(this, 'VpcId', {
      value: vpc.vpcId,
    });

    // ✅ Output Security Group ID
    new CfnOutput(this, 'SecurityGroupId', {
      value: securityGroup.securityGroupId,
    });
  }
}
