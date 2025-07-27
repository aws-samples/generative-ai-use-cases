const { defaultProvider } = require('@aws-sdk/credential-provider-node');
const { Client } = require('@opensearch-project/opensearch');
const { AwsSigv4Signer } = require('@opensearch-project/opensearch/aws');

const sleep = (msec) => new Promise((resolve) => setTimeout(resolve, msec));

const updateStatus = async (event, status, reason, physicalResourceId) => {
  const body = JSON.stringify({
    Status: status,
    Reason: reason,
    PhysicalResourceId: physicalResourceId,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    NoEcho: false,
    Data: {},
  });

  const res = await fetch(event.ResponseURL, {
    method: 'PUT',
    body,
    headers: {
      'Content-Type': '',
      'Content-Length': body.length.toString(),
    },
  });

  // For recording failures
  console.log(res);
  console.log(await res.text());
};

exports.handler = async (event, context) => {
  // For recording failures
  console.log(event);

  const props = event.ResourceProperties;
  const collectionId = props.collectionId;
  const region = process.env.AWS_DEFAULT_REGION;
  const client = new Client({
    ...AwsSigv4Signer({
      region,
      service: 'aoss',
      getCredentials: () => {
        const credentialsProvider = defaultProvider();
        return credentialsProvider();
      },
    }),
    node: `https://${collectionId}.${region}.aoss.amazonaws.com`,
  });

  try {
    switch (event.RequestType) {
      case 'Create':
        // parse number/boolean props
        const vectorDimension = Number(props.vectorDimension);
        const ragKnowledgeBaseBinaryVector =
          props.ragKnowledgeBaseBinaryVector.toLowerCase() === 'true';
        await client.indices.create({
          index: props.vectorIndexName,
          body: {
            mappings: {
              properties: {
                [props.metadataField]: {
                  type: 'text',
                  index: false,
                },
                [props.textField]: {
                  type: 'text',
                  analyzer: 'custom_kuromoji_analyzer',
                },
                [props.vectorField]: {
                  type: 'knn_vector',
                  dimension: vectorDimension,
                  ...(ragKnowledgeBaseBinaryVector
                    ? { data_type: 'binary' }
                    : {}),
                  method: {
                    engine: 'faiss',
                    space_type: ragKnowledgeBaseBinaryVector ? 'hamming' : 'l2',
                    name: 'hnsw',
                    parameters: {},
                  },
                },
              },
            },
            settings: {
              index: {
                knn: true,
                analysis: {
                  analyzer: {
                    custom_kuromoji_analyzer: {
                      type: 'custom',
                      tokenizer: 'kuromoji_tokenizer',
                      filter: [
                        'kuromoji_baseform',
                        'kuromoji_part_of_speech',
                        'kuromoji_stemmer',
                        'lowercase',
                        'ja_stop',
                      ],
                      char_filter: [
                        'kuromoji_iteration_mark',
                        'icu_normalizer',
                        'html_strip',
                      ],
                    },
                  },
                },
              },
            },
          },
        });
        await sleep(60 * 1000); // sleep 60s to confirm the creation
        await updateStatus(
          event,
          'SUCCESS',
          'Successfully created',
          props.vectorIndexName
        );
        break;
      case 'Update':
        await updateStatus(
          event,
          'SUCCESS',
          'Update operation is not supported',
          props.vectorIndexName
        );
        break;
      case 'Delete':
        const index = event.PhysicalResourceId;
        await client.indices.delete({
          index,
        });
        await updateStatus(event, 'SUCCESS', 'Successfully deleted', index);
        break;
    }
  } catch (e) {
    console.log('---- Error');
    console.log(e);

    const physicalResourceId =
      props.vectorIndexName || event.PhysicalResourceId;
    await updateStatus(event, 'FAILED', e.message, physicalResourceId);
  }
};
