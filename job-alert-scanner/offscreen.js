// Runs inside the offscreen document, which (unlike the background service
// worker) has access to DOMParser. background.js sends the raw HTML text it
// fetched and gets back structured job objects.

import { parseItviecDocument } from './sites/itviec.js';
import { parseLinkedinDocument } from './sites/linkedin.js';

const parser = new DOMParser();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'offscreen' || message?.type !== 'PARSE_HTML') return false;

  try {
    const doc = parser.parseFromString(message.html, 'text/html');
    let jobs = [];
    if (message.site === 'itviec') jobs = parseItviecDocument(doc, message.role);
    else if (message.site === 'linkedin') jobs = parseLinkedinDocument(doc, message.role);
    sendResponse({ ok: true, jobs });
  } catch (err) {
    sendResponse({ ok: false, error: String(err) });
  }
  return true;
});
