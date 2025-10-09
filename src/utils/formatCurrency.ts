export const formatCurrency = (
  value: number,
  currency: string = "CRC",
  locale: string = "es-CR"
) => {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
};
