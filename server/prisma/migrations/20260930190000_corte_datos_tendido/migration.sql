-- AlterTable
ALTER TABLE "Corte" ADD COLUMN     "anchoCm" INTEGER,
ADD COLUMN     "cortadorId" TEXT,
ADD COLUMN     "fechaCorte" TIMESTAMP(3),
ADD COLUMN     "tela" TEXT,
ADD COLUMN     "trazadoCm" INTEGER;

-- CreateTable
CREATE TABLE "_CorteDobladores" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CorteDobladores_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_CorteDobladores_B_index" ON "_CorteDobladores"("B");

-- AddForeignKey
ALTER TABLE "Corte" ADD CONSTRAINT "Corte_cortadorId_fkey" FOREIGN KEY ("cortadorId") REFERENCES "Operario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CorteDobladores" ADD CONSTRAINT "_CorteDobladores_A_fkey" FOREIGN KEY ("A") REFERENCES "Corte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CorteDobladores" ADD CONSTRAINT "_CorteDobladores_B_fkey" FOREIGN KEY ("B") REFERENCES "Operario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

