import "dotenv/config";

import * as bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { Role } from "../src/generated/prisma/enums";
import { z } from "zod";

const ADMIN_PASSWORD_SALT_ROUNDS = 12;

const seedEnvironmentSchema = z.object({
  ADMIN_EMAIL: z.email({ error: "ADMIN_EMAIL must be a valid email address." }),
  ADMIN_PASSWORD: z.string().min(12, { error: "ADMIN_PASSWORD must contain at least 12 characters." }),
  DATABASE_URL: z.url({ error: "DATABASE_URL must be a valid database URL." }),
});

async function main(): Promise<void> {
  const environment = seedEnvironmentSchema.parse(process.env);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: environment.DATABASE_URL }),
  });

  try {
    const email = environment.ADMIN_EMAIL.toLowerCase();
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      const passwordMatches = await bcrypt.compare(environment.ADMIN_PASSWORD, existingUser.passwordHash);

      await prisma.user.update({
        data: {
          ...(passwordMatches ? {} : {
            passwordHash: await bcrypt.hash(environment.ADMIN_PASSWORD, ADMIN_PASSWORD_SALT_ROUNDS),
          }),
          role: Role.ADMIN,
        },
        where: { id: existingUser.id },
      });
      return;
    }

    await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(environment.ADMIN_PASSWORD, ADMIN_PASSWORD_SALT_ROUNDS),
        role: Role.ADMIN,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

void main();
