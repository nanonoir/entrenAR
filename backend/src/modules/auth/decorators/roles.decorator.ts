import { SetMetadata } from "@nestjs/common";

import { ROLES_METADATA_KEY, type Role } from "../../../common/guards/roles.guard";

export const Roles = (...roles: readonly Role[]): MethodDecorator & ClassDecorator => {
  return SetMetadata(ROLES_METADATA_KEY, roles);
};
