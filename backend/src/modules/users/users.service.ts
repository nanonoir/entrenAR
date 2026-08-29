import { ConflictException, Injectable } from "@nestjs/common";
import * as bcrypt from "bcrypt";

import { PrismaService } from "../../common/prisma/prisma.service";
import { ERROR_CODE } from "../../common/errors/api-error.response";
import { ROLE, type Role } from "../../common/guards/roles.guard";
import type { Prisma } from "../../generated/prisma/client";

const PASSWORD_SALT_ROUNDS = 12;

export const AUTH_USER_SELECT = {
  birthDate: true,
  dni: true,
  email: true,
  firstName: true,
  gender: true,
  id: true,
  lastName: true,
  passwordHash: true,
  phone: true,
  role: true,
} satisfies Prisma.UserSelect;

const PUBLIC_USER_SELECT = {
  birthDate: true,
  dni: true,
  email: true,
  firstName: true,
  gender: true,
  id: true,
  lastName: true,
  phone: true,
  role: true,
} satisfies Prisma.UserSelect;

export interface UserProfileFields {
  birthDate?: Date | string | null;
  dni?: string | null;
  firstName?: string | null;
  gender?: string | null;
  lastName?: string | null;
  phone?: string | null;
}

export interface AuthUser extends UserProfileFields {
  email: string;
  id: string;
  passwordHash: string;
  role: Role;
}

export interface PublicUser {
  birthDate: string | null;
  dni: string | null;
  email: string;
  firstName: string | null;
  gender: string | null;
  id: string;
  lastName: string | null;
  phone: string | null;
  role: Role;
}

export function toPublicUserProjection(
  user: UserProfileFields & Pick<AuthUser, "email" | "id" | "role">,
): PublicUser {
  return {
    birthDate: toPublicBirthDate(user.birthDate),
    dni: user.dni ?? null,
    email: user.email,
    firstName: user.firstName ?? null,
    gender: user.gender ?? null,
    id: user.id,
    lastName: user.lastName ?? null,
    phone: user.phone ?? null,
    role: user.role,
  };
}

function toPublicBirthDate(birthDate: Date | string | null | undefined): string | null {
  if (!birthDate) {
    return null;
  }

  return birthDate instanceof Date ? birthDate.toISOString().slice(0, 10) : birthDate.slice(0, 10);
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createCustomer(email: string, password: string): Promise<AuthUser> {
    const normalizedEmail = email.toLowerCase();
    const existingUser = await this.findByEmail(normalizedEmail);

    if (existingUser) {
      throw new ConflictException({
        code: ERROR_CODE.CONFLICT,
        message: "An account with this email already exists.",
        ok: false,
      });
    }

    const passwordHash = await this.hashPassword(password);
    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role: ROLE.CUSTOMER,
      },
    });

    return user;
  }

  async findByEmail(email: string): Promise<AuthUser | null> {
    return this.prisma.user.findUnique({
      select: AUTH_USER_SELECT,
      where: { email: email.toLowerCase() },
    });
  }

  async findById(id: string): Promise<AuthUser | null> {
    return this.prisma.user.findUnique({
      select: AUTH_USER_SELECT,
      where: { id },
    });
  }

  async findPublicById(id: string): Promise<PublicUser | null> {
    const user = await this.prisma.user.findUnique({
      select: PUBLIC_USER_SELECT,
      where: { id },
    });

    return user ? this.toPublicUser(user) : null;
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
  }

  async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }

  toPublicUser(user: UserProfileFields & Pick<AuthUser, "email" | "id" | "role">): PublicUser {
    return toPublicUserProjection(user);
  }
}
