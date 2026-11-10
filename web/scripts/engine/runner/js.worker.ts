import { executeSuite } from './core.js';

self.onmessage = async (event: MessageEvent<{ code: string; tests: string }>) => {
  self.postMessage(await executeSuite(event.data.code, event.data.tests));
};
