#!/usr/bin/env node
;
/*
	cielo [-h | -n | -e | -d ]
*/
var brewCieloFile, brewCoffeeFile, brewStarbucksFile, brewTamlFile, checkDir, checkDirs, debugStarbucks, dirRoot, doWatch, envOnly, main, output, parseCmdArgs, readySeen, removeFile, unlinkRelatedFiles;

import parseArgs from 'minimist';

import pathlib from 'path';

import fs from 'fs';

import chokidar from 'chokidar';

import {
  assert,
  undef,
  warn,
  croak,
  words,
  sep_eq
} from '@jdeighan/coffee-utils';

import {
  log
} from '@jdeighan/coffee-utils/log';

import {
  slurp,
  barf,
  withExt,
  mkpath,
  forEachFile,
  newerDestFileExists,
  shortenPath
} from '@jdeighan/coffee-utils/fs';

import {
  setDebugging,
  debug
} from '@jdeighan/coffee-utils/debug';

import {
  hPrivEnv,
  logPrivEnv
} from '@jdeighan/coffee-utils/privenv';

import {
  loadPrivEnvFrom
} from '@jdeighan/env';

import {
  isTAML,
  taml
} from '@jdeighan/string-input/taml';

import {
  starbucks
} from '@jdeighan/starbucks';

import {
  brewCielo,
  brewCoffee
} from './brewCielo.js';

dirRoot = undef;

doWatch = true; // turn off with -n

envOnly = false; // set with -e

debugStarbucks = false; // set with -D

readySeen = false; // set true when 'ready' event is seen


// ---------------------------------------------------------------------------
main = function() {
  var watcher;
  parseCmdArgs();
  log(`DIR_ROOT: ${dirRoot}`);
  loadPrivEnvFrom(dirRoot);
  checkDirs();
  logPrivEnv();
  if (envOnly) {
    process.exit();
  }
  watcher = chokidar.watch(dirRoot, {
    persistent: doWatch
  });
  watcher.on('all', function(event, path) {
    var ext, lMatches;
    if (event === 'ready') {
      readySeen = true;
      if (doWatch) {
        log("...watching for further file changes");
      } else {
        log("...not watching for further file changes");
      }
      return;
    }
    if (path.match(/node_modules/)) {
      return;
    }
    if (lMatches = path.match(/\.(?:cielo|coffee|starbucks|taml)$/)) {
      log(`${event} ${shortenPath(path)}`);
      ext = lMatches[0];
      if (event === 'unlink') {
        unlinkRelatedFiles(path, ext);
      } else {
        switch (ext) {
          case '.cielo':
            brewCieloFile(path);
            break;
          case '.coffee':
            brewCoffeeFile(path);
            break;
          case '.starbucks':
            brewStarbucksFile(path);
            break;
          case '.taml':
            brewTamlFile(path);
            break;
          default:
            croak(`Invalid file extension: '${ext}'`);
        }
      }
    }
  });
};

// ---------------------------------------------------------------------------
unlinkRelatedFiles = function(path, ext) {
  // --- file 'path' was removed
  switch (ext) {
    case '.cielo':
      removeFile(path, '.coffee');
      break;
    case '.coffee':
    case '.taml':
      if (path.indexOf('_') === -1) {
        removeFile(path, '.js');
      } else {
        removeFile(path.replace('_', ''), '.js');
      }
      break;
    case '.starbucks':
      if (path.indexOf('_') === -1) {
        removeFile(path, '.svelte');
      } else {
        removeFile(path.replace('_', ''), '.svelte');
      }
      break;
    default:
      croak(`Invalid file extension: '${ext}'`);
  }
};

// ---------------------------------------------------------------------------
removeFile = function(path, ext) {
  var fullpath;
  // --- file 'path' was removed
  //     remove same file, but with ext 'ext'
  fullpath = withExt(path, ext);
  try {
    fs.unlinkSync(fullpath);
    log(`   unlink ${filename}`);
  } catch (error) {}
};

// ---------------------------------------------------------------------------
brewCieloFile = function(srcPath) {
  var coffeeCode, destPath;
  // --- cielo => coffee
  destPath = withExt(srcPath, '.coffee');
  if (newerDestFileExists(srcPath, destPath) && readySeen) {
    log("   dest exists");
    return;
  }
  coffeeCode = brewCielo(slurp(srcPath));
  output(coffeeCode, srcPath, destPath);
};

// ---------------------------------------------------------------------------
brewCoffeeFile = function(srcPath) {
  var destPath, jsCode;
  // --- coffee => js
  destPath = withExt(srcPath, '.js').replace('_', '');
  if (newerDestFileExists(srcPath, destPath) && readySeen) {
    log("   dest exists");
    return;
  }
  jsCode = brewCoffee(slurp(srcPath));
  output(jsCode, srcPath, destPath);
};

// ---------------------------------------------------------------------------
brewStarbucksFile = function(srcPath) {
  var code, content, destPath, hOptions, hParsed;
  destPath = withExt(srcPath, '.svelte').replace('_', '');
  if (newerDestFileExists(srcPath, destPath) && readySeen) {
    log("   dest exists");
    return;
  }
  content = slurp(srcPath);
  if (debugStarbucks) {
    log(sep_eq);
    log(content);
    log(sep_eq);
  }
  hParsed = pathlib.parse(srcPath);
  hOptions = {
    content: content,
    filename: hParsed.base
  };
  code = starbucks(hOptions).code;
  if (debugStarbucks) {
    log(code);
    log(sep_eq);
  }
  output(code, srcPath, destPath);
};

// ---------------------------------------------------------------------------
brewTamlFile = function(srcPath) {
  var destPath, envDir, hInfo, hParsed, srcDir, stub, tamlCode;
  destPath = withExt(srcPath, '.js').replace('_', '');
  if (newerDestFileExists(srcPath, destPath) && readySeen) {
    log("   dest exists");
    return;
  }
  hParsed = pathlib.parse(srcPath);
  srcDir = mkpath(hParsed.dir);
  envDir = hPrivEnv.DIR_STORES;
  assert(envDir, "DIR_STORES is not set!");
  if (srcDir !== envDir) {
    log(`   ${srcDir} is not ${envDir}`);
    return;
  }
  hInfo = pathlib.parse(destPath);
  stub = hInfo.name;
  tamlCode = slurp(srcPath);
  output(`import {TAMLDataStore} from '@jdeighan/starbucks/stores';

export let ${stub} = new TAMLDataStore(\`${tamlCode}\`);`, srcPath, destPath);
};

// ---------------------------------------------------------------------------
output = function(code, srcPath, destPath) {
  var err;
  try {
    barf(destPath, code);
  } catch (error) {
    err = error;
    log(`ERROR: ${err.message}`);
  }
  log(`   ${shortenPath(srcPath)} => ${shortenPath(destPath)}`);
};

// ---------------------------------------------------------------------------
parseCmdArgs = function() {
  var hArgs;
  // --- uses minimist
  hArgs = parseArgs(process.argv.slice(2), {
    boolean: words('h n e d D'),
    unknown: function(opt) {
      return true;
    }
  });
  // --- Handle request for help
  if (hArgs.h) {
    log("cielo [ <dir> ]");
    log("   -h help");
    log("   -n process files, don't watch for changes");
    log("   -e just display custom environment variables");
    log("   -d turn on debugging (a lot of output!)");
    log("   -D dump input & output from starbucks conversions");
    log("<dir> defaults to current working directory");
    process.exit();
  }
  if (hArgs.n) {
    doWatch = false;
  }
  if (hArgs.e) {
    envOnly = true;
  }
  if (hArgs.d) {
    log("extensive debugging on");
    setDebugging(true);
  }
  if (hArgs.D) {
    log("debugging starbucks conversions");
    debugStarbucks = true;
  }
  if (hArgs._ != null) {
    if (hArgs._.length > 1) {
      croak("Only one directory path allowed");
    }
    if (hArgs._.length === 1) {
      dirRoot = mkpath(hArgs._[0]);
    } else if (process.env.DIR_ROOT) {
      dirRoot = mkpath(process.env.DIR_ROOT);
    } else {
      dirRoot = process.env.DIR_ROOT = mkpath(process.cwd());
    }
  }
};

// ---------------------------------------------------------------------------
checkDir = function(name) {
  var dir;
  dir = hPrivEnv[name];
  if (dir && !fs.existsSync(dir)) {
    warn(`directory ${dir} does not exist - removing`);
    delete hPrivEnv[name];
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
