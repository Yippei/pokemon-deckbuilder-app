#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TERRAFORM_DIR="${AWS_TERRAFORM_DIR:-${HOME}/aws-backend-terraform}"
AWS_REGION="${AWS_REGION:-ap-northeast-1}"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI が見つかりません。先に AWS CLI を入れてください。" >&2
  exit 1
fi

if ! command -v terraform >/dev/null 2>&1; then
  echo "terraform が見つかりません。先に Terraform を入れてください。" >&2
  exit 1
fi

if [ ! -d "${TERRAFORM_DIR}" ]; then
  echo "Terraform ディレクトリが見つかりません: ${TERRAFORM_DIR}" >&2
  exit 1
fi

echo "1/4 ビルドしています..."
(cd "${FRONT_DIR}" && npm run build:aws)

FRONTEND_BUCKET_NAME="${FRONTEND_BUCKET_NAME:-$(terraform -chdir="${TERRAFORM_DIR}" output -raw frontend_bucket_name)}"
FRONTEND_CLOUDFRONT_DOMAIN="${FRONTEND_CLOUDFRONT_DOMAIN:-$(terraform -chdir="${TERRAFORM_DIR}" output -raw frontend_cloudfront_domain_name)}"
FRONTEND_CLOUDFRONT_DISTRIBUTION_ID="${FRONTEND_CLOUDFRONT_DISTRIBUTION_ID:-$(aws --region "${AWS_REGION}" cloudfront list-distributions --query "DistributionList.Items[?DomainName=='${FRONTEND_CLOUDFRONT_DOMAIN}'].Id | [0]" --output text)}"

if [ -z "${FRONTEND_BUCKET_NAME}" ] || [ "${FRONTEND_BUCKET_NAME}" = "None" ]; then
  echo "S3 バケット名を取得できませんでした。" >&2
  exit 1
fi

if [ -z "${FRONTEND_CLOUDFRONT_DISTRIBUTION_ID}" ] || [ "${FRONTEND_CLOUDFRONT_DISTRIBUTION_ID}" = "None" ]; then
  echo "CloudFront distribution id を取得できませんでした。" >&2
  exit 1
fi

echo "2/4 S3 へ同期しています..."
aws --region "${AWS_REGION}" s3 sync "${FRONT_DIR}/out" "s3://${FRONTEND_BUCKET_NAME}" --delete

echo "3/4 CloudFront を無効化しています..."
INVALIDATION_ID="$(aws --region "${AWS_REGION}" cloudfront create-invalidation --distribution-id "${FRONTEND_CLOUDFRONT_DISTRIBUTION_ID}" --paths '/*' --query 'Invalidation.Id' --output text)"

echo "4/4 完了しました。"
echo "Bucket: ${FRONTEND_BUCKET_NAME}"
echo "Distribution: ${FRONTEND_CLOUDFRONT_DISTRIBUTION_ID}"
echo "Invalidation: ${INVALIDATION_ID}"
