const { createApp } = require('./handler');
const { createPostgresAdapter } = require('./postgres-adapter');
const { createAliyunSmsAdapter } = require('./aliyun-sms-adapter');

const app = createApp({
  adapter: createPostgresAdapter(),
  sms: createAliyunSmsAdapter(),
});

exports.handler = (event) => app.handle(event);
