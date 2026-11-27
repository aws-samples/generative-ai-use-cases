// Imported first by fileRoutes.test.ts: the handlers read these at load time.
process.env.BUCKET_NAME = 'file-bucket';
process.env.AWS_REGION = 'us-east-1';
process.env.MODEL_REGION = 'us-east-1';
process.env.KNOWLEDGE_BASE_ID = '';
process.env.DOCUMENT_SOURCES = JSON.stringify([
  { kind: 'knowledgeBase', bucket: 'kb-bucket', prefix: 'docs/' },
  { kind: 'kendra', bucket: 'kendra-bucket', prefix: 'docs/' },
]);
