---
name: Cedar Cafe / Island Tacos separation boundary
description: Hard rules for keeping the two Replit projects completely separate — repeated violations have frustrated the user.
---

## The rule

**Cedar Cafe Replit and Island Tacos Replit are completely separate projects. Never touch one while working in the other.**

The user has explicitly asked multiple times for zero cross-contamination.

## How to know which project you are in

- Check the running workflows: if `artifacts/cedar-api` is present and `artifacts/api-server` is absent (or vice-versa), that tells you which project you are in.
- Cedar Cafe Replit production URL: `cedarcafebvi.com`
- Island Tacos Replit production URL: `orders.islandtacosbvi.com`
- Cedar Cafe Replit branch: `replit/cedar-cafe-tenant`
- Island Tacos Replit branch: `main`

## What belongs where

| Thing | Cedar Cafe Replit | Island Tacos Replit |
|---|---|---|
| Artifacts registered | cedar-cafe, cedar-api only | island-tacos, api-server only |
| Database (executeSql) | cedarcafe DB in THIS project's Postgres | heliumdb / default DB in THAT project's Postgres |
| Git push | `replit/cedar-cafe-tenant` | `main` |
| API port | 8181 (cedar-api) | 8080 (api-server) |

## What caused past violations

1. Agent cleared the **wrong database** — ran `executeSql` targeting `cedarcafe` DB but was in the Island Tacos Replit (different Postgres instance entirely). Each Replit has its own Postgres; `executeSql` hits the current project's DB.
2. Agent pushed code and made commits while in Cedar Cafe Replit that were meant for Island Tacos work, and vice-versa.
3. `island-tacos` and `api-server` artifact.toml files were left in the Cedar Cafe Replit monorepo checkout, causing Island Tacos to deploy to cedarcafebvi.com. **Fixed Aug 2026: those artifact.toml files deleted from Cedar Cafe Replit.**

## Before doing anything, orient first

1. Read the running workflows list to confirm which project you're in.
2. Never run `executeSql` without first confirming which Replit project you're in.
3. Never push to GitHub without confirming you're pushing to the correct branch.
4. Never install, build, or modify Island Tacos artifacts from within the Cedar Cafe Replit, or vice-versa.
