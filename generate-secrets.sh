#!/bin/bash

# LegacyVideo - Secret Generation Script
# Run this script to generate all required secrets for Railway deployment

echo "🔐 LegacyVideo Secret Generator"
echo "================================"
echo ""

echo "1️⃣  API_SECRET (for JWT token signing):"
echo "API_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
echo ""

echo "2️⃣  MASTER_ENCRYPTION_KEY (for video encryption):"
echo "⚠️  SAVE THIS KEY SECURELY - if you lose it, all encrypted videos become unrecoverable!"
echo "MASTER_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
echo ""

echo "✅ Copy these values to:"
echo "   - Railway API Service → Variables"
echo "   - Railway Worker Service → Variables (use SAME encryption key for both!)"
echo ""
echo "📋 Next steps: See SETUP_SECRETS.md for complete deployment guide"
