-- DropForeignKey
ALTER TABLE "public"."checklist_answers" DROP CONSTRAINT "checklist_answers_itemId_fkey";

-- AlterTable
ALTER TABLE "public"."checklist_answers" ADD COLUMN     "itemLabel" TEXT,
ADD COLUMN     "itemOptions" TEXT[] NOT NULL DEFAULT '{}',
ADD COLUMN     "itemOrder" INTEGER,
ADD COLUMN     "itemRequired" BOOLEAN,
ADD COLUMN     "itemType" TEXT,
ALTER COLUMN "itemId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."checklist_answers" ADD CONSTRAINT "checklist_answers_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "public"."checklist_template_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
