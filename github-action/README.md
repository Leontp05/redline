# Redline GitHub Action

Run an automated red-teaming scan against your LLM system prompt on every push and pull request. The action fails the build if the security score drops below a threshold.

## Quick Start

### 1. Get a Redline API key

1. Go to [Redline](https://redline-orcin.vercel.app/app) → Settings → API Keys
2. Click "Create" → copy the key (`rl_live_xxx`)

### 2. Add the key to your repo

GitHub → your repo → Settings → Secrets and variables → Actions → New repository secret:
- **Name**: `REDLINE_API_KEY`
- **Value**: `rl_live_xxx`

### 3. Add the workflow

Create `.github/workflows/redline.yml` in your repo:

```yaml
name: Redline Security Scan

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Read system prompt
        id: prompt
        run: |
          echo "prompt<<EOF" >> $GITHUB_OUTPUT
          cat ./prompts/system-prompt.txt >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT

      - name: Redline Security Scan
        uses: Leontp05/redline@main
        with:
          api-key: ${{ secrets.REDLINE_API_KEY }}
          system-prompt: ${{ steps.prompt.outputs.prompt }}
          min-score: '70'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `api-key` | ✅ | — | Your Redline API key (`rl_live_xxx`) |
| `system-prompt` | One of the two | — | The system prompt to test |
| `target-id` | One of the two | — | An existing target ID to scan |
| `target-name` | ❌ | `CI/CD Scan` | Name for the target |
| `api-url` | ❌ | `https://redline-orcin.vercel.app` | Redline API base URL |
| `min-score` | ❌ | `50` | Minimum score to pass (0-100) |
| `fail-on-vulnerable` | ❌ | `false` | Fail if ANY vulnerability is found |
| `timeout-minutes` | ❌ | `5` | Max minutes to wait for scan |

## Outputs

| Output | Description |
|--------|-------------|
| `scan-id` | The ID of the completed scan |
| `score` | Overall security score (0-100) |
| `vulnerable-count` | Number of vulnerable results |
| `total-count` | Total number of attack results |
| `report-url` | URL to view the full report |

## Examples

### Fail on any vulnerability

```yaml
- name: Redline Security Scan
  uses: Leontp05/redline@main
  with:
    api-key: ${{ secrets.REDLINE_API_KEY }}
    system-prompt: ${{ steps.prompt.outputs.prompt }}
    fail-on-vulnerable: 'true'
```

### Use an existing target

```yaml
- name: Redline Security Scan
  uses: Leontp05/redline@main
  with:
    api-key: ${{ secrets.REDLINE_API_KEY }}
    target-id: 'cmrXXXXXXXXXXXXXXXX'
    min-score: '80'
```

### Comment on PRs

The action automatically comments on pull requests with a score summary table. Just make sure `permissions: pull-requests: write` is set and `GITHUB_TOKEN` is passed as an env var.

## How it works

1. Creates a target from your system prompt (or uses an existing one)
2. Starts a scan — 40 attack payloads fire against the LLM
3. Polls every 3 seconds until the scan completes
4. Checks the score against `min-score`
5. Fails the build if below threshold (or if `fail-on-vulnerable` is set)
6. Comments on the PR with a score summary table

## Cost

Each scan uses ~40 LLM calls (Groq + Gemini free tiers). At 1000 requests/day on Groq's free tier, you can run ~25 scans/day for free.
