/*
  Warnings:

  - Made the column `price` on table `Product` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "ProductVariant_primaryImageId_idx";

-- DropIndex
DROP INDEX "RefreshToken_userId_idx";

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "price" SET NOT NULL;

-- AlterTable
ALTER TABLE "RefreshToken" ALTER COLUMN "sessionType" SET DEFAULT 'CUSTOMER';
