import { registerDecorator, ValidationOptions } from 'class-validator';

// True only for a plain https link: no login details inside the link, no
// odd ports, and a sensible length. Used for "apply here", registration and
// meeting links, which other users will tap on. Links like javascript: or
// http: are rejected.
export function isHttpsUrl(value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0 || value.length > 500) {
    return false;
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  return (
    url.protocol === 'https:' &&
    url.username === '' &&
    url.password === '' &&
    (url.port === '' || url.port === '443') &&
    url.hostname.includes('.')
  );
}

export function IsHttpsUrl(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isHttpsUrl',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be a full https link (for example https://example.com/apply)`,
        ...validationOptions,
      },
      validator: {
        validate: (value: unknown) => isHttpsUrl(value),
      },
    });
  };
}
