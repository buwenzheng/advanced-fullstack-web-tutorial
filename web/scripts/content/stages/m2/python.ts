import type { PythonBlockMap, PythonTrackMap } from '../../types.js';
import {
  PYTHON_BLOCKS as DATA_BLOCKS,
  PYTHON_TRACKS as DATA_TRACKS,
} from './python-data.js';
import {
  PYTHON_BLOCKS as API_BLOCKS,
  PYTHON_TRACKS as API_TRACKS,
} from './python-api.js';

export const PYTHON_BLOCKS: PythonBlockMap = Object.assign({}, DATA_BLOCKS, API_BLOCKS);
export const PYTHON_TRACKS: PythonTrackMap = Object.assign({}, DATA_TRACKS, API_TRACKS);
