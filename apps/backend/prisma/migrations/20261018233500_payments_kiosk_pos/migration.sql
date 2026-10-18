-- AlterEnum
ALTER TYPE "AppointmentSource" ADD VALUE 'KIOSK';

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "prepaidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "payment_intents" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "copyPaste" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'HOSTED',
ADD COLUMN     "qrCode" TEXT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "cpApiKey" TEXT,
ADD COLUMN     "cpWebhookSecret" TEXT,
ADD COLUMN     "kioskEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kioskToken" TEXT,
ADD COLUMN     "onlinePaymentEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "posAccessToken" TEXT,
ADD COLUMN     "posDeviceId" TEXT,
ADD COLUMN     "posEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "posProvider" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "tenants_kioskToken_key" ON "tenants"("kioskToken");

