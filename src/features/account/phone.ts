export const normalizeChinaPhoneInput = (value: string) => {
  const compact = value.trim().replace(/[\s-]/g, '');

  if (/^\+\d{8,15}$/.test(compact)) {
    return compact;
  }

  const digits = compact.replace(/\D/g, '');
  const localDigits = digits.startsWith('86') && digits.length === 13 ? digits.slice(2) : digits;

  return /^1[3-9]\d{9}$/.test(localDigits) ? `+86${localDigits}` : null;
};

export const formatChinaLocalPhoneInput = (value: string) => {
  const digits = value.replace(/\D/g, '');
  const localDigits = digits.startsWith('86') && digits.length > 11 ? digits.slice(2) : digits;

  return localDigits.slice(0, 11);
};
