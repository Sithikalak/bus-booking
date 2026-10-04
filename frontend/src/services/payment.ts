export function validCard(number: string) {
  const digits = number.replace(/\s/g, "");
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  for (let i = digits.length - 1, parity = 0; i >= 0; i--, parity++) {
    let n = +digits[i];
    if (parity % 2) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}
export function validExpiry(value: string, now = new Date()) {
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(value);
  if (!match) return false;
  return new Date(2000 + +match[2], +match[1], 1) > now;
}
// Only documented test-card numbers may be tokenized. Card data never leaves the browser.
export function mockCardToken(number: string) {
  const digits = number.replace(/\s/g, "");
  if (digits === "4000000000000002") return "mock_decline";
  if (digits === "4000000000003220") return "mock_refund_fail";
  if (digits === "4242424242424242") return "mock_success";
  throw new Error(
    "Use a documented test card. Real cards are not accepted in development.",
  );
}
