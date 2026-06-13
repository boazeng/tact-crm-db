# TACT-CRM — AWS deployment (serverless)

Deploys: FastAPI on **Lambda** behind an **HTTP API**, a **private RDS PostgreSQL**,
and the React SPA on **S3 + CloudFront**. CloudFront routes `/api/*` to the API and
everything else to S3 — one origin, no CORS, RDS never public.

```
                    ┌──────────── CloudFront ────────────┐
   browser ───────► │  /api/*  → HTTP API → Lambda ──┐    │
                    │  /*      → S3 (React build)     │    │
                    └─────────────────────────────────┼────┘
                                                       ▼
                                              RDS PostgreSQL (private, in-VPC)
```

## Prerequisites
- **AWS CLI** configured (already done — account `824980746386`, region `us-east-1`).
- **AWS SAM CLI** — `sam --version`. Install: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
- **Docker Desktop running** — required for `sam build --use-container`, which builds
  `psycopg2-binary` and `bcrypt` as **Linux/arm64** wheels (a plain Windows build ships
  the wrong binaries and the Lambda fails at import).
- **Node 20** for the frontend build.

---

## Step 0 — pick a VPC + two subnets
RDS needs a subnet group spanning **≥2 AZs**. Use the default VPC:

```powershell
aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query "Vpcs[0].VpcId" --output text
aws ec2 describe-subnets --filters Name=vpc-id,Values=<VPC_ID> --query "Subnets[].{id:SubnetId,az:AvailabilityZone}" --output table
```
Note the VPC id and **two subnet ids in different AZs**.

## Step 1 — build
```powershell
cd infra
sam build --use-container
```

## Step 2 — deploy the stack (first time: guided)
```powershell
sam deploy --guided
```
Answer the prompts (stack `tact-crm`, region `us-east-1`) and supply parameters:

| Parameter | Value |
|---|---|
| `VpcId` | from Step 0 |
| `SubnetIds` | the two subnet ids, comma-separated |
| `DBUsername` | `crmadmin` (default) |
| `DBPassword` | strong, ≥12 chars, **no** `/ @ " ` or spaces |
| `JwtSecret` | long random (e.g. `python -c "import secrets;print(secrets.token_urlsafe(48))"`) |
| `SeedAdminEmail` | your admin email |
| `SeedAdminPassword` | strong, ≥10 chars |
| `DBInstanceClass` | `db.t4g.micro` (default) |

RDS creation takes ~5–10 min. Note the **Outputs**: `SiteURL`, `FrontendBucketName`,
`DistributionId`, `MigrateFunctionName`.

> Re-deploys after the first time: just `sam build --use-container && sam deploy`
> (params are remembered in `samconfig.toml`; secrets are re-prompted or pass
> `--parameter-overrides`).

## Step 3 — create the schema + super_admin
Invoke the migrate function once (it runs `create_all` + seeds the super_admin from
`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`):

```powershell
aws lambda invoke --function-name tact-crm-migrate --cli-binary-format raw-in-base64-out out.json
cat out.json   # → {"tables":"ensured","super_admin_email":"...","super_admin_id":1}
```

## Step 4 — build + publish the frontend
```powershell
cd ../frontend
npm install
npm run build
aws s3 sync dist/ s3://<FrontendBucketName>/ --delete
aws cloudfront create-invalidation --distribution-id <DistributionId> --paths "/*"
```

## Step 5 — log in
Open **`SiteURL`** in the browser → log in with `SeedAdminEmail` / `SeedAdminPassword`.
(The dev-login dropdown does **not** appear — `ENABLE_DEV_LOGIN=false` in production.)

---

## Operating notes

**Future schema changes** — `create_all` only adds missing tables. To evolve an existing
schema without data loss, run Alembic against RDS. RDS is private, so either temporarily
flip `PubliclyAccessible` + a temporary ingress rule from your IP, or run Alembic from a
bastion/CloudShell in the VPC. (For now `tact-crm-migrate` covers initial standup.)

**Production hardening** (when it holds real customer data):
- `MultiAZ: true` on the RDS (HA; ~2× DB cost).
- `DeletionProtection: true` on the RDS.
- Move `DBPassword` / `JwtSecret` from Lambda env vars to **AWS Secrets Manager**
  (needs a VPC endpoint for Secrets Manager, since the Lambda has no internet route).

**Rough monthly cost** (low traffic, us-east-1):
- RDS `db.t4g.micro` Single-AZ + 20GB gp3 ≈ **$13–16**
- Lambda + HTTP API ≈ **$0–3**
- S3 + CloudFront ≈ **$1–5**
- **≈ $15–25/month.** (Multi-AZ adds ~$13.)

**Tear down** — `sam delete` (RDS keeps a final snapshot via its `DeletionPolicy`).
