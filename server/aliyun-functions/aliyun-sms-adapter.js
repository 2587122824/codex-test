const tryLoadSmsClient = () => {
  try {
    return require('@alicloud/dysmsapi20170525').default;
  } catch {
    throw new Error(
      'Alibaba SMS adapter requires `@alicloud/dysmsapi20170525` in the Function Compute deployment bundle.',
    );
  }
};

const tryLoadOpenApiConfig = () => {
  try {
    return require('@alicloud/openapi-client').Config;
  } catch {
    throw new Error(
      'Alibaba SMS adapter requires `@alicloud/openapi-client` in the Function Compute deployment bundle.',
    );
  }
};

const createAliyunSmsAdapter = ({
  accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID,
  accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET,
  signName = process.env.ALIYUN_SMS_SIGN_NAME,
  templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE,
  endpoint = process.env.ALIYUN_SMS_ENDPOINT || 'dysmsapi.aliyuncs.com',
} = {}) => {
  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
    throw new Error('Alibaba SMS adapter is missing access key, sign name, or template code environment variables.');
  }

  const SmsClient = tryLoadSmsClient();
  const OpenApiConfig = tryLoadOpenApiConfig();
  const client = new SmsClient(
    new OpenApiConfig({
      accessKeyId,
      accessKeySecret,
      endpoint,
    }),
  );

  return {
    async sendCode({ phone, code }) {
      const result = await client.sendSms({
        phoneNumbers: phone.replace(/^\+86/, ''),
        signName,
        templateCode,
        templateParam: JSON.stringify({ code }),
      });
      const response = result.body || {};
      if (response.code && response.code !== 'OK') {
        throw new Error(response.message || `Alibaba SMS failed with code ${response.code}.`);
      }
      return { requestId: response.requestId || result.headers?.['x-acs-request-id'] || '' };
    },
  };
};

module.exports = {
  createAliyunSmsAdapter,
};
