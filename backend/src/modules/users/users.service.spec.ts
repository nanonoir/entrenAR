import { PrismaService } from "../../common/prisma/prisma.service";
import { ROLE } from "../../common/guards/roles.guard";
import { UsersService } from "./users.service";

describe("users.service", () => {
  it("loads /me with a secret-free public projection", async () => {
    const prisma = createPrismaHarness();
    prisma.user.findUnique.mockResolvedValue({
      birthDate: new Date("1990-01-01T00:00:00.000Z"),
      dni: "12345678",
      email: "customer@entrenar.test",
      firstName: "Ada",
      gender: "other",
      id: "customer-id",
      lastName: "Lovelace",
      phone: "+54 11 5555-5555",
      role: ROLE.CUSTOMER,
    });

    const user = await prisma.service.findPublicById("customer-id");

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      select: {
        birthDate: true,
        dni: true,
        email: true,
        firstName: true,
        gender: true,
        id: true,
        lastName: true,
        phone: true,
        role: true,
      },
      where: { id: "customer-id" },
    });
    expect(user).toEqual({
      birthDate: "1990-01-01",
      dni: "12345678",
      email: "customer@entrenar.test",
      firstName: "Ada",
      gender: "other",
      id: "customer-id",
      lastName: "Lovelace",
      phone: "+54 11 5555-5555",
      role: ROLE.CUSTOMER,
    });
    expect(user).not.toHaveProperty("passwordHash");
    expect(user).not.toHaveProperty("refreshTokens");
    expect(user).not.toHaveProperty("passwordResetTokens");
  });

  it("limits credential lookups to authentication fields and the account display fields", async () => {
    const prisma = createPrismaHarness();
    prisma.user.findUnique.mockResolvedValue({
      birthDate: null,
      dni: null,
      email: "customer@entrenar.test",
      firstName: null,
      gender: null,
      id: "customer-id",
      lastName: null,
      passwordHash: "stored-hash",
      phone: null,
      role: ROLE.CUSTOMER,
    });

    const user = await prisma.service.findById("customer-id");

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      select: {
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
      },
      where: { id: "customer-id" },
    });
    expect(user).toEqual(expect.objectContaining({
      email: "customer@entrenar.test",
      id: "customer-id",
      passwordHash: "stored-hash",
      role: ROLE.CUSTOMER,
    }));
  });
});

function createPrismaHarness(): UsersHarness {
  const user = {
    findUnique: jest.fn(),
  };
  const service = new UsersService({ user } as unknown as PrismaService);

  return { service, user };
}

interface UsersHarness {
  service: UsersService;
  user: {
    findUnique: jest.Mock;
  };
}
