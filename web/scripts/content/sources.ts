import * as s0 from './stages/s0/index.js';
import * as s1 from './stages/s1/index.js';
import * as s2 from './stages/s2/index.js';
import * as s3 from './stages/s3/index.js';
import * as s4 from './stages/s4/index.js';
import * as s5 from './stages/s5/index.js';
import * as s6 from './stages/s6/index.js';
import * as s7 from './stages/s7/index.js';
import * as appendix from './stages/appendix/index.js';
import type { StageInput } from './types.js';

export const stageInputs: StageInput[] = [
  { data: s0.stage0, pythonBlocks: s0.PYTHON_BLOCKS, pythonTracks: s0.PYTHON_TRACKS },
  { data: s1.stage1, pythonBlocks: s1.PYTHON_BLOCKS, pythonTracks: s1.PYTHON_TRACKS },
  { data: s2.stage2, pythonBlocks: s2.PYTHON_BLOCKS, pythonTracks: s2.PYTHON_TRACKS },
  { data: s3.stage3, pythonBlocks: s3.PYTHON_BLOCKS, pythonTracks: s3.PYTHON_TRACKS },
  { data: s4.stage4, pythonBlocks: s4.PYTHON_BLOCKS, pythonTracks: s4.PYTHON_TRACKS },
  { data: s5.stage5, pythonBlocks: s5.PYTHON_BLOCKS, pythonTracks: s5.PYTHON_TRACKS },
  { data: s6.stage6, pythonBlocks: s6.PYTHON_BLOCKS, pythonTracks: s6.PYTHON_TRACKS },
  { data: s7.stage7, pythonBlocks: s7.PYTHON_BLOCKS, pythonTracks: s7.PYTHON_TRACKS },
  {
    data: appendix.stageAppendix,
    pythonBlocks: appendix.PYTHON_BLOCKS,
    pythonTracks: appendix.PYTHON_TRACKS,
  },
];
