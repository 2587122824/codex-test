const { createApp } = require('./handler');
const { createPostgresAdapter } = require('./postgres-adapter');
const { createAliyunSmsAdapter } = require('./aliyun-sms-adapter');

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

let app;

const createLocalSmsAdapter = () => ({
  async sendCode() {
    return { requestId: `local-sms-${Date.now()}` };
  },
});

const createSmsAdapter = () => {
  if (process.env.SMS_PROVIDER === 'local') {
    if (!process.env.LOCAL_SMS_FIXED_CODE) {
      throw new Error('SMS_PROVIDER=local requires LOCAL_SMS_FIXED_CODE.');
    }
    return createLocalSmsAdapter();
  }

  return createAliyunSmsAdapter();
};

const getApp = () => {
  if (!app) {
    app = createApp({
      adapter: createPostgresAdapter(),
      sms: createSmsAdapter(),
    });
  }
  return app;
};

const errorResponse = (error) => {
  console.error('[gudemian-api] handler failed:', error);
  return {
    statusCode: 500,
    headers: jsonHeaders,
    body: JSON.stringify({
      message: 'Function handler failed.',
      code: 'FUNCTION_HANDLER_ERROR',
      detail: error && error.message ? error.message : 'Unknown error',
    }),
  };
};

exports.handler = async (event) => {
  try {
    return await getApp().handle(event);
  } catch (error) {
    return errorResponse(error);
  }
};
