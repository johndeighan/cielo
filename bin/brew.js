// brew.coffee
var brewFile, dumpDirs, main;

import {
  strict as assert
} from 'assert';

import {
  existsSync,
  lstatSync
} from 'fs';

import {
  parse
} from 'path';

import {
  undef,
  pass
} from '@jdeighan/coffee-utils';

import {
  log
} from '@jdeighan/coffee-utils/log';

import {
  slurp,
  barf,
  getFullPath,
  forEachFile,
  withExt,
  mkpath
} from '@jdeighan/coffee-utils/fs';

import {
  setDebugging,
  debug
} from '@jdeighan/coffee-utils/debug';

import {
  untabify
} from '@jdeighan/coffee-utils/indent';

import {
  loadEnvFrom
} from '@jdeighan/env';

import {
  starbucks
} from '@jdeighan/starbucks';

/*
	brew <dir>    -- brew all files in directory tree
*/
// ---------------------------------------------------------------------------
main = function() {
  var callback, dir, ent, orgPath, path;
  orgPath = process.argv[2];
  debug(`brew(): orgPath = '${orgPath}'`);
  assert(orgPath, "Missing file/directory name on command line");
  path = getFullPath(orgPath);
  // --- may be a file or a directory
  assert(existsSync(path), `'${path}' does not exist`);
  ent = lstatSync(path);
  if (ent.isFile()) {
    log(`brew file '${path}'`);
    // --- Load environment from directory containing source file
    ({dir} = parse(path));
    debug(`file is in directory '${dir}'`);
    loadEnvFrom(dir);
    dumpDirs();
    return brewFile(path);
  } else if (ent.isDirectory()) {
    log(`brew files in dir '${path}'`);
    // --- Load environment from given directory
    loadEnvFrom(path);
    dumpDirs();
    callback = function(filename, dir, level) {
      brewFile(mkpath(dir, filename));
    };
    return forEachFile(path, callback, /\.starbucks$/);
  }
};

// ---------------------------------------------------------------------------
brewFile = function(filepath) {
  var content, result;
  debug(`filepath = '${filepath}'`);
  content = slurp(filepath);
  debug("CONTENT:", content);
  result = starbucks({
    content,
    filename: filepath
  });
  barf(withExt(filepath, '.svelte'), untabify(result.code));
  log(`BREW: ${filepath} -> *.svelte`);
};

// ---------------------------------------------------------------------------
dumpDirs = function() {
  var key, ref, value;
  ref = process.env;
  // --- Print out names of defined directories
  for (key in ref) {
    value = ref[key];
    if ((key.indexOf('DIR_') === 0) || (key.indexOf('dir_') === 0)) {
      log(`${key} = ${value}`);
    }
  }
};

// ---------------------------------------------------------------------------
main();
