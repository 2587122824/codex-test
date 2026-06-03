const { createApp } = require('./handler');
const { createPostgresAdapter } = require('./postgres-adapter');
const { createAliyunSmsAdapter } = require('./aliyun-sms-adapter');

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

const app = createApp({
  adapter: createPostgresAdapter(),
  sms: createSmsAdapter(),
});

exports.handler = (event) => app.handle(event);
