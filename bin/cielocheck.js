#!/usr/bin/env node
;
var checkDir, checkDirs, dirRoot, doDebug, dumpOptions, lFiles, main, nProcessed, parseCmdArgs, quiet;

import parseArgs from 'minimist';

import pathlib from 'path';

import fs from 'fs';

import chokidar from 'chokidar';

import {
  exec
} from 'child_process';

import {
  assert,
  undef,
  warn,
  croak,
  words,
  sep_eq,
  nonEmpty,
  isString,
  isArray
} from '@jdeighan/coffee-utils';

import {
  log
} from '@jdeighan/coffee-utils/log';

import {
  slurp,
  withExt,
  mkpath,
  forEachFile,
  newerDestFileExists,
  shortenPath,
  isFile,
  isDir,
  isSimpleFileName,
  getFullPath,
  fileExt
} from '@jdeighan/coffee-utils/fs';

import {
  setDebugging,
  debug
} from '@jdeighan/coffee-utils/debug';

import {
  loadEnvFrom
} from '@jdeighan/env';

import {
  getNeededSymbols
} from '@jdeighan/string-input/coffee';

import {
  brewCieloFile
} from '@jdeighan/string-input/cielo';

import {
  brewCoffee
} from '@jdeighan/string-input/coffee';

dirRoot = undef; // set in parseCmdArgs()

lFiles = []; // to process individual files


// --- Default values for flags
doDebug = false; // set with -d

quiet = false; // set with -q

nProcessed = 0;

// ---------------------------------------------------------------------------
main = function() {
  var i, lEnvFiles, len, path, watcher;
  parseCmdArgs();
  process.env.DIR_ROOT = dirRoot;
  lEnvFiles = loadEnvFrom(dirRoot);
  checkDirs();
  if (nonEmpty(lFiles)) {
// --- Process only these files
    for (i = 0, len = lFiles.length; i < len; i++) {
      path = lFiles[i];
      if (fileExt(path) === '.cielo') {
        if (!quiet) {
          log(`BREW ${shortenPath(path)}`);
        }
        // --- This creates the *.coffee file
        brewCieloFile(path);
      }
    }
    dumpStats(); // --- DONE
    return;
  }
  watcher = chokidar.watch(dirRoot, {
    persistent: false
  });
  watcher.on('ready', function() {
    if (!quiet) {
      return dumpStats();
    }
  });
  watcher.on('all', function(event, path) {
    // --- never process files in a node_modules directory
    //     or any directory whose name begins with '.'
    if (path.match(/node_modules/) || path.match(/[\/\\]\./)) {
      return;
    }
    if (fileExt(path) === '.cielo') {
      if (!quiet) {
        log(`${event} ${shortenPath(path)}`);
      }
      if (event !== 'unlink') {
        return brewCieloFile(path);
      }
    }
  });
};

// ---------------------------------------------------------------------------
dumpOptions = function() {
  log("OPTIONS:");
  log(`   doDebug = ${doDebug}`);
  log(`   quiet   = ${quiet}`);
};

// ---------------------------------------------------------------------------
parseCmdArgs = function() {
  var hArgs, i, j, len, len1, path, ref;
  // --- uses minimist
  hArgs = parseArgs(process.argv.slice(2), {
    boolean: words('h d q D'),
    unknown: function(opt) {
      return true;
    }
  });
  // --- Handle request for help
  if (hArgs.h) {
    log("cielocheck { <dir> | <file> }");
    log("   -h help");
    log("   -d turn on some debugging");
    log("   -q quiet output (only errors)");
    log("   -D turn on debugging (a lot of output!)");
    log("<dir> defaults to current working directory");
    process.exit();
  }
  if (hArgs.d) {
    doDebug = true;
  }
  if (hArgs.q) {
    quiet = true;
  }
  if (!quiet) {
    dumpOptions();
  }
  if (hArgs.D) {
    setDebugging(true);
  }
  if (hArgs._ != null) {
    ref = hArgs._;
    for (i = 0, len = ref.length; i < len; i++) {
      path = ref[i];
      if (path.indexOf('.') === 0) {
        // --- relative path - convert to absolute
        path = getFullPath(path); // converts \ to /
      } else {
        path = mkpath(path); // convert \ to /
      }
      if (isDir(path)) {
        assert(!dirRoot, "multiple dirs not allowed");
        dirRoot = path;
        if (!quiet) {
          log(`DIR_ROOT: ${dirRoot} (from cmd line)`);
        }
      } else if (isFile(path)) {
        lFiles.push(path);
      } else {
        croak(`Invalid path '${path}' on command line`);
      }
    }
  }
  if (!dirRoot) {
    dirRoot = mkpath(process.cwd());
    if (!quiet) {
      log(`DIR_ROOT: ${dirRoot} (from cwd())`);
    }
  }
  // --- set env var DIR_ROOT
  process.env.DIR_ROOT = dirRoot;
// --- Convert any simple file names in lFiles to full path
  for (j = 0, len1 = lFiles.length; j < len1; j++) {
    path = lFiles[j];
    if (isSimpleFileName(path)) {
      path = mkpath(dirRoot, path);
    }
  }
};

// ---------------------------------------------------------------------------
checkDir = function(key) {
  var dir;
  dir = process.env[key];
  if (dir && !fs.existsSync(dir)) {
    if (doDebug) {
      warn(`directory ${key} '${dir}' does not exist - removing`);
    }
    delete process.env[key];
  }
};

// ---------------------------------------------------------------------------
checkDirs = function() {
  var key;
  for (key in hPrivEnv) {
    if (key.match(/^DIR_/)) {
      checkDir(key);
    }
  }
};

// ---------------------------------------------------------------------------
main();
