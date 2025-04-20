#!/bin/bash

# This script helps remove sensitive data from your Git repository history
# Before running this script, make sure you have:
# 1. Removed sensitive data from your current working tree
# 2. Added proper entries to .gitignore 
# 3. Committed these changes

echo "WARNING: This script will permanently modify your Git history."
echo "Make sure you have backed up your repository before proceeding."
echo "If this repository is already pushed to a remote, you will need to force push after running this script."
read -p "Are you sure you want to proceed? (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ]; then
    echo "Operation cancelled."
    exit 0
fi

# Remove service account credentials from history
echo "Removing service account credentials from Git history..."
git filter-branch --force --index-filter \
    "git rm --cached --ignore-unmatch backend/service_acc.json" \
    --prune-empty --tag-name-filter cat -- --all

# Remove API keys from background.js
echo "Removing API keys from background.js history..."
git filter-branch --force --index-filter \
    "git rm --cached --ignore-unmatch frontend/src/background.js" \
    --prune-empty --tag-name-filter cat -- --all

# Remove any potential .env files
echo "Removing .env files from Git history..."
git filter-branch --force --index-filter \
    "git rm --cached --ignore-unmatch .env */.env" \
    --prune-empty --tag-name-filter cat -- --all

# Force garbage collection
echo "Forcing garbage collection..."
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo "Done! The sensitive data should now be removed from your Git history."
echo ""
echo "IMPORTANT: If you've already pushed this repository to a remote, you will need to force push:"
echo "  git push origin --force --all"
echo ""
echo "Note: Force pushing is destructive to the remote repository. Make sure you understand the implications." 