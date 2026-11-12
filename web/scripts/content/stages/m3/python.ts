import type { PythonBlockMap, PythonTrackMap } from '../../types.js';
import {
  PYTHON_BLOCKS as SHIP_BLOCKS,
  PYTHON_TRACKS as SHIP_TRACKS,
} from './python-ship.js';
import {
  PYTHON_BLOCKS as PRODUCTION_BLOCKS,
  PYTHON_TRACKS as PRODUCTION_TRACKS,
} from './python-production.js';
import {
  PYTHON_BLOCKS as WEB_BLOCKS,
  PYTHON_TRACKS as WEB_TRACKS,
} from './python-web.js';

export const PYTHON_BLOCKS: PythonBlockMap = Object.assign(
  {},
  SHIP_BLOCKS,
  PRODUCTION_BLOCKS,
  WEB_BLOCKS,
);
export const PYTHON_TRACKS: PythonTrackMap = Object.assign(
  {},
  SHIP_TRACKS,
  PRODUCTION_TRACKS,
  WEB_TRACKS,
);
