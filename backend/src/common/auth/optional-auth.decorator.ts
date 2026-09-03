import { SetMetadata } from "@nestjs/common";

export const OPTIONAL_AUTH_METADATA_KEY = "optional-auth";

export function OptionalAuth(): MethodDecorator & ClassDecorator {
  return SetMetadata(OPTIONAL_AUTH_METADATA_KEY, true);
}
