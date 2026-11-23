// Custom resource handler for StackOutputs (lib/construct/stack-outputs.ts).
// Reads the requested outputs of another stack, possibly in another Region,
// and returns them as attributes keyed by output name.
const {
  CloudFormationClient,
  DescribeStacksCommand,
} = require('@aws-sdk/client-cloudformation');

exports.handler = async (event) => {
  const { StackName, Region, OutputKeys } = event.ResourceProperties;
  // The physical ID stays the same across updates, so an update never
  // replaces the resource. Delete has nothing to clean up.
  const physicalResourceId = event.PhysicalResourceId ?? StackName;
  if (event.RequestType === 'Delete') {
    return { PhysicalResourceId: physicalResourceId };
  }

  const client = new CloudFormationClient({ region: Region });
  const res = await client.send(new DescribeStacksCommand({ StackName }));
  const outputs = res.Stacks?.[0]?.Outputs ?? [];

  const data = {};
  for (const key of OutputKeys) {
    const output = outputs.find((o) => o.OutputKey === key);
    if (output === undefined) {
      throw new Error(`Output ${key} not found in stack ${StackName}`);
    }
    data[key] = output.OutputValue;
  }
  return { PhysicalResourceId: physicalResourceId, Data: data };
};
