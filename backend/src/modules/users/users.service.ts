import { ConflictException, Injectable } from "@nestjs/common";
import * as bcrypt from "bcrypt";

import { PrismaService } from "../../common/prisma/prisma.service";
import { ERROR_CODE } from "../../common/errors/api-error.response";
import { ROLE, type Role } from "../../common/guards/roles.guard";

const PASSWORD_SALT_ROUNDS = 12;

export interface AuthUser {
  email: string;
  id: string;
  passwordHash: string;
  role: Role;
}

export interface PublicUser {
  email: string;
  id: string;
  role: Role;
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
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  async findPublicById(id: string): Promise<PublicUser | null> {
    return this.prisma.user.findUnique({
      select: {
        email: true,
        id: true,
        role: true,
      },
      where: { id },
    });
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
  }

  async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }
}
