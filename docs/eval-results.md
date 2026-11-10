# Classification eval results

Gold set: [`apps/api/eval/classification.jsonl`](../apps/api/eval/classification.jsonl), 162 companies hand-labelled by an analyst into the default taxonomy (`null` = out of scope for the sector).

- **dev**: the full Legal AI cohort (102). The heuristic keyword lists were written while reading these companies, so heuristic scores on *dev* are optimistic.
- **heldout**: 32 Climate Tech and 28 Payments companies, sampled systematically (every 5th / 7th company in directory order) and labelled after the keywords were frozen. Treat this split as the honest estimate.

Metrics: accuracy (exact subsector, including correctly saying "out of scope"); macro-F1 over subsectors; and the review-queue trade-off at the 0.75 threshold: the share of companies the system would auto-accept, and how accurate those auto-accepted labels are. The rest go to the human review queue.

## How to reproduce

```bash
npm run eval -w apps/api                                   # offline heuristic baseline
ANTHROPIC_API_KEY=… npm run eval -w apps/api -- --provider anthropic
OPENAI_API_KEY=…    npm run eval -w apps/api -- --provider openai
GEMINI_API_KEY=…    npm run eval -w apps/api -- --provider gemini --split heldout
```

Add `--out docs/eval-results-<provider>.md` to save a run. CI runs the heuristic eval on every push and posts the table to the job summary.

## Status of LLM runs

**Gemini (gemini-3.6-flash), partial run, 2026-11-10.** The Gemini free tier allows 20 requests per model per day, so the first run stopped after **41 of 162** companies, all from the dev split (Legal AI). Failed calls are excluded rather than scored. The held-out split, which is the honest estimate, has not been measured yet. The eval is resumable (`apps/api/eval/.cache-gemini.json`), so it can be finished across days with `npm run eval -w apps/api -- --provider gemini --split heldout`.

| Split | n | Accuracy | Macro-F1 | Auto-accepted | Accuracy of auto-accepted |
|---|---:|---:|---:|---:|---:|
| dev (Legal AI), first 41 companies | 41 | 87.8% | 0.917 | 85.4% | 94.3% |

For comparison, the heuristic on the full dev split scores 75.5% accuracy, but its keyword lists were written while reading these companies, so its dev score is optimistic. Read the Gemini dev number as "strong on Legal AI", not as a held-out result.

<details><summary>Gemini errors (5 of 41)</summary>

| Company | Expected | Predicted | Confidence |
|---|---|---|---:|
| lawdingo | legal-ops | legal-consumer | 0.65 |
| caribou | (out of scope) | legal-ai-firms | 0.85 |
| version-story-compare | legal-contracts | legal-workspace | 0.75 |
| trebol | (out of scope) | legal-compliance | 0.55 |
| pigeon-2 | (out of scope) | legal-consumer | 0.70 |

Three of the five errors are companies an analyst marked out of scope that the model placed inside the taxonomy: the main failure mode is over-inclusion, which the review queue catches when confidence is below 0.75.

</details>

OpenAI and Anthropic are implemented and unit-tested against a mock but have not been evaluated (no keys).

## Results: heuristic baseline


Review threshold: 0.75

| Split | n | Accuracy | Macro-F1 | Auto-accepted | Accuracy of auto-accepted |
|---|---:|---:|---:|---:|---:|
| all | 162 | 72.2% | 0.683 | 58.0% | 84.0% |
| dev (Legal AI) | 102 | 75.5% | 0.778 | 65.7% | 91.0% |
| heldout (Climate + Payments) | 60 | 66.7% | 0.620 | 45.0% | 66.7% |

<details><summary>Errors</summary>

| Company | Expected | Predicted | Confidence |
|---|---|---|---:|
| lawdingo | legal-ops | legal-ai-firms | 0.45 |
| simplelegal | legal-ops | legal-workspace | 0.58 |
| jeugene | legal-contracts | legal-workspace | 0.71 |
| legalist | (out of scope) | legal-ai-firms | 0.68 |
| aclu | (out of scope) | legal-litigation | 0.71 |
| cognition-ip | legal-ai-firms | legal-ip | 0.63 |
| spire-law | legal-ai-firms | legal-litigation | 0.58 |
| caribou | (out of scope) | legal-ai-firms | 0.71 |
| datasaur | (out of scope) | legal-compliance | 0.64 |
| panadata | legal-compliance | legal-contracts | 0.40 |
| firstbase-io | legal-consumer | legal-compliance | 0.35 |
| argovox | (out of scope) | legal-ops | 0.85 |
| landeed | (out of scope) | legal-contracts | 0.68 |
| pointone | legal-ops | legal-ai-firms | 0.68 |
| elayne | legal-consumer | legal-litigation | 0.76 |
| closure | (out of scope) | legal-compliance | 0.85 |
| caseflood-ai | legal-plaintiff | legal-ai-firms | 0.45 |
| openintake | legal-plaintiff | legal-ai-firms | 0.58 |
| vesence | (out of scope) | legal-workspace | 0.71 |
| vulcan-technologies | legal-compliance | legal-workspace | 0.57 |
| legalos | legal-ai-firms | legal-immigration | 0.71 |
| autositu | (out of scope) | legal-compliance | 0.71 |
| wingman-law | legal-ai-firms | legal-plaintiff | 0.77 |
| erinys | legal-ops | legal-ai-firms | 0.92 |
| perceptron-ml | legal-workspace | legal-ai-firms | 0.76 |
| reach | climate-energy | climate-buildings | 0.71 |
| georgette-packaging | climate-industry | climate-carbon | 0.80 |
| talyn-air | climate-mobility | climate-energy | 0.68 |
| perfekto | climate-food | climate-industry | 0.50 |
| posh | (out of scope) | climate-industry | 0.49 |
| stralis-aircraft | climate-mobility | climate-energy | 0.62 |
| sorcerer | climate-software | climate-buildings | 0.68 |
| slidepay | pay-acquiring | pay-embedded | 0.82 |
| tipjoy | pay-consumer | pay-acquiring | 0.76 |
| kash | pay-acquiring | pay-cards | 0.68 |
| razorpay | pay-acquiring | pay-crossborder | 0.79 |
| paystack | pay-acquiring | pay-crossborder | 0.45 |
| tpaga | pay-consumer | pay-crossborder | 0.45 |
| pagaloop | pay-b2b | pay-cards | 0.89 |
| staffbar | pay-acquiring | pay-embedded | 0.89 |
| truss | pay-b2b | pay-cards | 0.76 |
| alma | pay-consumer | (none) | 0.30 |
| drip | pay-consumer | pay-cards | 0.76 |
| vendora | (out of scope) | pay-acquiring | 0.76 |
| allowance | pay-cards | pay-acquiring | 0.35 |

</details>

## Reading the baseline

- **The threshold earns its keep.** Overall accuracy is 72%, but labels above 0.75 confidence are 84% accurate (91% on dev), and the remaining 42% of companies go to an analyst. Raising the threshold trades analyst time for precision.
- **Held-out drops to 67%.** Keyword rules generalise poorly. Typical errors: *geography words outvote function* (Razorpay and Paystack are acceptance businesses but mention India/Africa → "Cross-border"); *business model vs. practice area* (an AI-native PI law firm matches "personal injury" before "law firm"); *out-of-scope companies* that share vocabulary (law-enforcement software matched "compliance").
- **These are exactly the cases an LLM with the taxonomy definitions should fix**, because the definitions state the tie-break rules in words ("applies regardless of practice area"). The eval exists to verify that rather than assume it.
