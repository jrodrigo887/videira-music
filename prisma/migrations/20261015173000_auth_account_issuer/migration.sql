ALTER TABLE "auth_account" ADD COLUMN "issuer" TEXT;

UPDATE "auth_account"
SET "issuer" = CASE
  WHEN "providerId" = 'google' THEN 'https://accounts.google.com'
  ELSE 'local:oauth:' || "providerId"
END
WHERE "issuer" IS NULL;

ALTER TABLE "auth_account" ALTER COLUMN "issuer" SET NOT NULL;

CREATE UNIQUE INDEX "auth_account_issuer_accountId_key" ON "auth_account"("issuer", "accountId");
