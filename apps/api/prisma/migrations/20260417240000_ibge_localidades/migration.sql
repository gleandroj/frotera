-- CreateTable
CREATE TABLE "ibge_ufs" (
    "sigla" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "ibge_ufs_pkey" PRIMARY KEY ("sigla")
);

-- CreateTable
CREATE TABLE "ibge_municipios" (
    "id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "ufSigla" TEXT NOT NULL,

    CONSTRAINT "ibge_municipios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ibge_municipios_ufSigla_nome_idx" ON "ibge_municipios"("ufSigla", "nome");

-- AddForeignKey
ALTER TABLE "ibge_municipios" ADD CONSTRAINT "ibge_municipios_ufSigla_fkey" FOREIGN KEY ("ufSigla") REFERENCES "ibge_ufs"("sigla") ON DELETE CASCADE ON UPDATE CASCADE;
