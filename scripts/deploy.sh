#!/bin/bash
# Script to build and push to gh-pages branch manually

# Exit on error
set -e

# Ensure we are in the root directory
cd "$(dirname "$0")/.."

# Get the current git remote url
REMOTE_URL=$(git config --get remote.origin.url)

if [ -z "$REMOTE_URL" ]; then
    echo "Error: Could not find remote 'origin'. Please ensure you have a git remote named 'origin' configured."
    exit 1
fi

echo "Building project..."
npm run build

echo "Creating temporary deployment directory..."
mkdir -p deploy_temp
cp -r dist/* deploy_temp

# Go to temp dir
cd deploy_temp

echo "Initializing git..."
git init
git add .
git commit -m "Deploy to GitHub Pages"

# Add the remote
git remote add origin "$REMOTE_URL"

echo "Pushing to gh-pages branch..."
# Push to the gh-pages branch of the remote
git push --force origin HEAD:gh-pages

echo "Cleaning up..."
cd ..
rm -rf deploy_temp

echo "Deployed successfully!"
