// No browser, network, API key, or third-party test dependencies required.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'hungarian-letter-studio.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);

function studio() {
  const elements = new Map();
  const element = () => ({ value: '', checked: true, dataset: {}, style: {}, children: [],
    classList: { toggle() {} }, addEventListener() {}, setAttribute() {},
    replaceChildren() { this.children = []; }, append(...children) { this.children.push(...children); },
    click() {}, focus() {}, querySelector() { return null; } });
  const context = vm.createContext({ console, Blob, URL, AbortController, DOMException,
    setTimeout, clearTimeout, setImmediate, Uint8Array, ArrayBuffer,
    window: { addEventListener() {} },
    document: {
      getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
      querySelectorAll() { return []; }, createElement: element
    }
  });
  // In a browser window is the global object; mirror that for bundled JSZip.
  context.window = context;
  context.addEventListener = () => {};
  scripts.forEach(script => vm.runInContext(script, context));
  const run = code => vm.runInContext(code, context);
  run("$('provider').value='openai'; $('model').value='gpt-4.1'; $('maxTokens').value='8192'; $('apiKey').value='test-secret'; fillPrices();");
  return { context, run, elements };
}

test('Hungarian NFC scoring preserves accents and weights reference lengths', () => {
  const { run } = studio();
  assert.equal(run("score('ő', 'o\\u030b', true).ce"), 0);
  assert.equal(run("score('ő', 'o', true).ce"), 1);
  assert.equal(run("score('egy  szó', 'egy szó', true).we"), 0);
  assert.equal(run("score('egy  szó', 'egy szó', false).ce"), 1);
  assert.equal(run("score('a', 'abcd', true).ce"), 3);
  run("pairs=[{name:'a',reference:'a',result:{text:'x'}},{name:'b',reference:'abcdefghi',result:{text:'abcdefghi'}}]; renderScores();");
  assert.equal(run("$('cer').textContent"), '10.00%');
});

test('OpenAI cached input is billed once; blank and zero rates differ', () => {
  const { run } = studio();
  run("var tokens=usageBreakdown('openai',{input_tokens:1000,output_tokens:100,input_tokens_details:{cached_tokens:400}})");
  assert.equal(run('tokens.total'), 1100);
  assert.equal(run('tokens.input'), 600);
  assert.equal(run('estimatedCost(tokens,{input:2,cached:.5,output:8})'), .0022);
  assert.equal(run('estimatedCost(tokens,{input:2,cached:null,output:8})'), null);
  assert.equal(run('estimatedCost(tokens,{input:0,cached:0,output:0})'), 0);
  assert.equal(run("usageBreakdown('openai',{})"), null);
});

test('Anthropic reads and both cache write durations are accounted for', () => {
  const { run } = studio();
  run("var tokens=usageBreakdown('anthropic',{input_tokens:100,output_tokens:20,cache_read_input_tokens:50,cache_creation_input_tokens:50,cache_creation:{ephemeral_5m_input_tokens:30,ephemeral_1h_input_tokens:20}})");
  assert.equal(run('tokens.inputTotal'), 200);
  assert.equal(run('tokens.total'), 220);
  assert.ok(Math.abs(run('estimatedCost(tokens,{input:3,cached:.3,write5:3.75,write60:6,output:15})') - .0008475) < 1e-12);
  assert.equal(run("estimatedCost(usageBreakdown('anthropic',{input_tokens:1,output_tokens:1,cache_creation_input_tokens:10}),{input:3,output:15})"), null);
});

test('run totals include truncated usage but exclude truncated accuracy', () => {
  const { run } = studio();
  run("runInfo={provider:'openai',normalize:true,prices:{input:2,output:8}}; pairs=[{name:'a',reference:'a',result:{text:'a',usage:{input_tokens:100,output_tokens:10}}},{name:'b',reference:'b',result:{text:'wrong',truncated:true,usage:{input_tokens:200,output_tokens:20}}},{name:'c',reference:'c',error:'Stopped'}]; renderScores();");
  assert.equal(run("$('cer').textContent"), '0.00%');
  assert.equal(run("$('doneCount').textContent"), '1 / 3');
  assert.equal(run('usageSummary().totalTokens'), 330);
  assert.equal(run('usageSummary().incomplete'), true);
  assert.equal(run("$('costTotal').textContent"), '$0.000840 + unknown');
});

test('price snapshots survive edits and unknown models have blank rates', () => {
  const { run } = studio();
  run("var saved=readPrices(); $('priceInput').value='99'");
  assert.equal(run('saved.input'), 2);
  run("$('model').value='custom-model'; fillPrices()");
  assert.equal(run('readPrices().input'), null);
  run("$('priceInput').value='-1'");
  assert.throws(() => run('readPrices()'), /nonnegative/);
});

test('both provider request formats and response parsing work without network', async () => {
  const { run, context } = studio();
  run("imageData=async()=> 'data:image/jpeg;base64,aW1hZ2U=';");
  let captured;
  context.fetch = async (url, options) => {
    captured = { url, ...options, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: 'Árvíztűrő' }] }], usage: { input_tokens: 10, output_tokens: 5 } }) };
  };
  const result = await run("ask(settings(),'Transcribe only',new Blob(),new AbortController().signal)");
  assert.equal(result.text, 'Árvíztűrő');
  assert.equal(captured.url, 'https://api.openai.com/v1/responses');
  assert.equal(captured.body.store, false);
  assert.equal(captured.headers.Authorization, 'Bearer test-secret');
  assert.equal(captured.body.input[0].content[0].text, 'Transcribe only');
  context.fetch = async (url, options) => {
    captured = { url, ...options, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'levél' }], stop_reason: 'max_tokens', usage: { input_tokens: 8, output_tokens: 4 } }) };
  };
  run("$('provider').value='anthropic'");
  assert.equal((await run("ask(settings(),'Read',new Blob(),new AbortController().signal)")).truncated, true);
  assert.equal(captured.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(captured.headers['anthropic-dangerous-direct-browser-access'], 'true');
  assert.equal(captured.body.messages[0].content[0].source.media_type, 'image/jpeg');
});

test('provider errors and cancellation retain explicit failures', async () => {
  const { run, context } = studio();
  run("imageData=async()=> 'data:image/jpeg;base64,AA=='");
  context.fetch = async () => ({ ok: false, status: 429, json: async () => ({ error: { message: 'Rate limited' } }) });
  await assert.rejects(run("ask(settings(),'Read',new Blob(),new AbortController().signal)"), /API 429: Rate limited/);
  context.fetch = async () => { throw Error('network'); };
  await assert.rejects(run("ask(settings(),'Read',new Blob(),new AbortController().signal)"), /Could not reach openai/);
  await assert.rejects(run("var aborted=new AbortController(); aborted.abort(); ask(settings(),'Read',new Blob(),aborted.signal)"), /Stopped/);
});

test('evaluation withholds references, exports usage and never exports key', async () => {
  const { run, context } = studio();
  run("imageData=async()=> 'data:image/jpeg;base64,AA=='; pairs=[{name:'letter.jpg',reference:'PRIVATE REFERENCE',blob:new Blob()}];");
  let request;
  context.fetch = async (_, options) => {
    request = options.body;
    return { ok: true, json: async () => ({ output: [{ content: [{ type: 'output_text', text: 'levél' }] }], usage: { input_tokens: 100, output_tokens: 10 } }) };
  };
  // onclick invokes work without returning its promise; await its completion.
  run("$('runEval').onclick()");
  for (let i = 0; i < 100 && run('busy'); i++) await new Promise(setImmediate);
  assert.equal(run('busy'), false);
  assert.ok(request);
  assert.ok(!request.includes('PRIVATE REFERENCE'));
  run("var exported; download=(blob)=>{exported=blob}; $('exportEval').onclick()");
  const exported = await run('exported.text()');
  assert.ok(!exported.includes('test-secret'));
  const data = JSON.parse(exported);
  assert.equal(data.results[0].reference, 'PRIVATE REFERENCE');
  assert.equal(data.usageSummary.totalTokens, 110);
  assert.equal(data.run.prices.input, 2);
  assert.ok(Math.abs(data.results[0].estimatedCostUsd - .00028) < 1e-12);
});

test('transcription retains editable text and prompt generation can seed evaluation', async () => {
  const { run, context } = studio();
  run("imageData=async()=> 'data:image/jpeg;base64,AA=='; pages=[makePage('letter.jpg',new Blob())];");
  let request;
  context.fetch = async (_, options) => {
    request = options.body;
    return { ok: true, json: async () => ({ output: [{ content: [{ type: 'output_text', text: 'Kedves barátom' }] }] }) };
  };
  await run('transcribe([0])');
  assert.equal(run('pages[0].text'), 'Kedves barátom');
  assert.equal(run('pages[0].state'), 'Done');
  run("$('transOutput').value='Kedves Barátom'; $('transOutput').oninput()");
  assert.equal(run('pages[0].text'), 'Kedves Barátom');
  run("example=makePage('example.jpg',new Blob()); $('knownTranscript').value='VERIFIED EXAMPLE'; $('generatePrompt').onclick()");
  for (let i = 0; i < 100 && run('busy'); i++) await new Promise(setImmediate);
  assert.equal(run('busy'), false);
  assert.ok(request.includes('VERIFIED EXAMPLE'));
  run("$('useEvalPrompt').onclick()");
  assert.equal(run("$('evalPrompt').value"), 'Kedves barátom');
});

test('bundled ZIP library round-trips Hungarian text and nested paths', async () => {
  const { run } = studio();
  const text = await run("(async()=>{const z=new JSZip(); z.file('letters/001.txt','Árvíztűrő tükörfúrógép'); const data=await z.generateAsync({type:'uint8array'}); const restored=await JSZip.loadAsync(data); return restored.file('letters/001.txt').async('string')})()");
  assert.equal(text, 'Árvíztűrő tükörfúrógép');
  assert.equal(run("stem('letters/001.jpg')===stem('letters/001.txt')"), true);
});

test('publish list excludes private files and every local catalogue link resolves', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'useml-site-test-'));
  try {
    fs.mkdirSync(path.join(temp, 'scripts'));
    fs.mkdirSync(path.join(temp, 'licenses'));
    const files = ['index.html', 'hungarian-letter-studio.html', 'hungarian-letter-studio.docs.md', 'transcribe.py', 'whisply_script.py', 'yt-dlp-script.py', 'CNAME', 'LICENSE', 'licenses/JSZip-LICENSE.md', 'scripts/build-site.sh'];
    files.forEach(file => fs.copyFileSync(path.join(root, file), path.join(temp, file)));
    for (const file of ['.env', 'private.txt', 'recording.m4a', 'Hungarian-Letter-Studio.zip']) fs.writeFileSync(path.join(temp, file), 'PRIVATE');
    execFileSync('sh', ['scripts/build-site.sh'], { cwd: temp });
    const output = path.join(temp, '_site');
    assert.deepEqual(fs.readdirSync(output).sort(), [...files.filter(f => !f.includes('/')), 'licenses', '.nojekyll'].sort());
    assert.equal(fs.readFileSync(path.join(output, 'CNAME'), 'utf8').trim(), 'tools.useml.net');
    const index = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
    for (const [, href] of index.matchAll(/href="([^"]+)"/g)) {
      if (!href.startsWith('https:')) assert.ok(fs.existsSync(path.join(output, href)), href);
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
