# Hungarian Letter Studio

A self-contained HTML page with plain JavaScript and CSS. No build step or server backend. JSZip 3.10.1 (MIT) is embedded for local ZIP import and export. No CDN scripts or analytics.

## Run
Open `dist/index.html` in a modern desktop browser. If your browser blocks requests from a local file, serve the folder:

```sh
python3 -m http.server 8000 --directory dist
```

Then visit http://localhost:8000. Supply an OpenAI or Anthropic API key and a vision-capable model ID. Model availability depends on your provider account; the model field is editable.

## Three workflows
1. **Transcribe:** upload PNG/JPEG/WebP images or a ZIP containing them; customize the Hungarian transcription prompt; run a selected page or all pending pages. Review and edit the transcript. Export a ZIP of UTF-8 transcripts plus a manifest with original paths, exact prompts, provider/model, timestamps, usage and original model responses.
2. **Build a prompt:** upload an image and paste its verified transcript. Add requirements, generate reusable instructions, edit them, and copy into either other panel. This action sends both image and known transcript to the provider.
3. **Evaluate:** upload images and UTF-8 `.txt` references together, either as individual files or a ZIP. Paths must match except for extensions (`folder/page01.jpg` + `folder/page01.txt`). Alternatively add each pair manually. Only the image and evaluation prompt are sent to the provider, never the reference. Export each run before starting the next; JSON includes the exact prompt, model, settings, references, predictions and edit counts.

Evaluation computes corpus-weighted character error rate and word error rate using Levenshtein distance. Unicode NFC normalization is always applied; optional whitespace normalization collapses runs and trims edges. Case, Hungarian accents and punctuation remain significant. Words are whitespace-delimited. Rates can exceed 100%. Empty references are rejected. Failed or truncated outputs are visibly excluded from corpus scores.

## Behavior and limits
- API keys, scans and outputs stay in tab memory until you explicitly send a provider request or download an export. Closing/reloading clears the workspace. Keys are never exported or stored in browser storage.
- Use only your own key on a trusted copy of this page. Direct browser API access is intended for personal use; a shared application should use a server proxy.
- API calls are sequential. Stop cancels the browser request; an already accepted provider request may still incur charges. No automatic retries.
- Requests time out after three minutes. Errors retain completed work. Increase the output token limit when a page is marked truncated.
- Images are converted to JPEG with a maximum 3,000-pixel edge. Keep original scans separately. Check small handwriting carefully after resizing.
- PNG, JPEG and WebP only. No PDF, TIFF, HEIC, animated images or password-protected archives.
- Each upload <=200 MB; extracted image/text <=30 MB; import <=300 MB expanded and <=1,000 supported files. Split large archives. Browser memory limits may require smaller batches.
- Same-path duplicates are skipped. A new evaluation replaces the current run. Exports do not contain the original scans.
- Browser/network CORS policies can block direct provider requests. Anthropic requests include its direct-browser opt-in header. Serving from localhost can resolve local-file restrictions but not all provider or network policies.
- Scores measure agreement with your chosen reference convention, not historical correctness. Use independent held-out letters for evaluation rather than the example used to generate the prompt.

## API references
- https://developers.openai.com/api/docs/guides/images-vision
- https://platform.claude.com/docs/en/api/messages
- https://github.com/anthropics/anthropic-sdk-typescript

## Verification
Request construction, response parsing, ZIP import, Unicode scoring and error paths are checked with mocked provider responses. Visual browser QA could not run because the browser binary download failed. No paid provider requests were made; test one page with your key before processing an archive. Optional WebMCP prompt-setting support is feature-detected; native browser WebMCP validation is unavailable in the build environment.

## Evaluation token usage and price
The evaluation panel shows API-reported input and output tokens, per-page estimated USD cost, and running totals. Prices are editable USD per million tokens. Presets for GPT-4.1, GPT-4.1 mini and Claude Sonnet 4 were checked against official pricing on 2026-09-27. Other model IDs start with blank rates. Prices are captured at run start; later edits affect only the next run.

OpenAI cached tokens are subtracted from total input before applying the uncached rate. Anthropic cache reads/writes are added to its uncached input count and charged at their respective rates. Unknown cache-write duration or missing rates produces unknown cost rather than a false zero. Output usage already includes any provider-reported reasoning tokens. No image token surcharge is added separately because API input usage already accounts for the image.

Truncated responses are included in usage/cost while excluded from accuracy scores. Failed or cancelled requests can incur charges without returning usage, so totals are estimates for reported responses only, not an invoice. The JSON export includes raw usage, normalized token categories, per-page estimates, run totals and the price snapshot. Rates assume standard API service, excluding tax and negotiated discounts.
