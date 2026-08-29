import { Injectable } from "@nestjs/common";

import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";

export const wishlistItemSelect = {
  createdAt: true,
  productId: true,
} satisfies Prisma.WishlistItemSelect;

export type WishlistItemRecord = Prisma.WishlistItemGetPayload<{ select: typeof wishlistItemSelect }>;

@Injectable()
export class WishlistRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByUser(userId: string): Promise<WishlistItemRecord[]> {
    return this.prisma.wishlistItem.findMany({
      orderBy: [{ createdAt: "asc" }, { productId: "asc" }],
      select: wishlistItemSelect,
      where: { userId },
    });
  }

  async findByUserAndProduct(userId: string, productId: string): Promise<WishlistItemRecord | null> {
    return this.prisma.wishlistItem.findUnique({
      select: wishlistItemSelect,
      where: { userId_productId: { productId, userId } },
    });
  }

  async create(userId: string, productId: string): Promise<WishlistItemRecord> {
    return this.prisma.wishlistItem.create({
      data: { productId, userId },
      select: wishlistItemSelect,
    });
  }

  async delete(userId: string, productId: string): Promise<boolean> {
    const result = await this.prisma.wishlistItem.deleteMany({
      where: { productId, userId },
    });

    return result.count === 1;
  }
}
