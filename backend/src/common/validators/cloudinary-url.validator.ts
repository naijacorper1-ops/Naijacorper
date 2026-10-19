import { registerDecorator, ValidationOptions } from 'class-validator';

// True only for a link to a file that was uploaded through our own upload
// endpoints. Without this, anyone could attach any website's image (or a
// tracking pixel, or something worse) to a post or listing.
//
// Our upload URLs look like:
//   https://res.cloudinary.com/<cloud>/image/upload/v123/naijacorper/<folder>/<file>.jpg
export function isOurCloudinaryUrl(value: unknown, folder: string): boolean {
  if (typeof value !== 'string' || value.length > 600) {
    return false;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

  if (!cloudName) {
    return false;
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'res.cloudinary.com' ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== ''
  ) {
    return false;
  }

  const prefix = `/${cloudName}/`;

  if (!url.pathname.startsWith(prefix)) {
    return false;
  }

  const rest = url.pathname.slice(prefix.length);

  // Public uploads only (not "authenticated" documents), from the right folder.
  return /^(image|video)\/upload\//.test(rest) && rest.includes(`/naijacorper/${folder}/`);
}

// Use with { each: true } on arrays:
//   @IsCloudinaryUrl('posts', { each: true })
export function IsCloudinaryUrl(folder: string, validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isCloudinaryUrl',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must only contain files uploaded through our upload endpoints`,
        ...validationOptions,
      },
      validator: {
        validate: (value: unknown) => isOurCloudinaryUrl(value, folder),
      },
    });
  };
}
