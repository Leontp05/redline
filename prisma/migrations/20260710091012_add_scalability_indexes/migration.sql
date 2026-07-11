-- CreateIndex
CREATE INDEX "Result_scanId_success_idx" ON "Result"("scanId", "success");

-- CreateIndex
CREATE INDEX "Result_attackTypeId_idx" ON "Result"("attackTypeId");

-- CreateIndex
CREATE INDEX "Target_parentId_idx" ON "Target"("parentId");
