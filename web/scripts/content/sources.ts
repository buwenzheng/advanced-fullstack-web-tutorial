import * as m1 from './stages/m1/index.js';
import * as m2 from './stages/m2/index.js';
import * as m3 from './stages/m3/index.js';
import * as m4 from './stages/m4/index.js';
import * as e1 from './stages/e1/index.js';
import * as b from './stages/b/index.js';
import type { StageInput } from './types.js';

export const stageInputs: StageInput[] = [
  { data: m1.stageM1, pythonBlocks: m1.PYTHON_BLOCKS, pythonTracks: m1.PYTHON_TRACKS },
  { data: m2.stageM2, pythonBlocks: m2.PYTHON_BLOCKS, pythonTracks: m2.PYTHON_TRACKS },
  { data: m3.stageM3, pythonBlocks: m3.PYTHON_BLOCKS, pythonTracks: m3.PYTHON_TRACKS },
  { data: m4.stageM4, pythonBlocks: m4.PYTHON_BLOCKS, pythonTracks: m4.PYTHON_TRACKS },
  { data: e1.stageE1, pythonBlocks: e1.PYTHON_BLOCKS, pythonTracks: e1.PYTHON_TRACKS },
  { data: b.stageB, pythonBlocks: b.PYTHON_BLOCKS, pythonTracks: b.PYTHON_TRACKS },
];
