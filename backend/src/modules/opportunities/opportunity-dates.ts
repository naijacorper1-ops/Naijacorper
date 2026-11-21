// A deadline can be sent as a plain date ("2026-12-31") or as a full date and
// time. A plain date means the end of that day in Nigeria (UTC+1, no daylight
// saving), so an opportunity closing on the 31st is still open on the 31st.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function parseDeadline(value: string): Date {
  if (DATE_ONLY.test(value)) {
    return new Date(`${value}T22:59:59.999Z`);
  }

  return new Date(value);
}
