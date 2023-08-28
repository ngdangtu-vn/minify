#!/usr/bin/env node

import tryToCatch from 'try-to-catch';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);

const Pack = require('../package');
const Version = Pack.version;

const log = function(...args) {
    console.log(...args);
    process.stdin.pause();
};

const Argv = process.argv;
const files = Argv.slice(2);
const [In] = files;

log.error = (e) => {
    console.error(e);
    process.stdin.pause();
};

process.on('uncaughtException', (error) => {
    if (error.code !== 'EPIPE')
        log(error);
});

await minify();

function readStd(callback, options) {
    const {stdin} = process;
    let chunks = '';
    
    const read = () => {
        const chunk = stdin.read();
        
        if (chunk)
            return chunks += chunk;
        
        stdin.removeListener('readable', read);
        callback(chunks, options);
    };
    
    stdin.setEncoding('utf8');
    stdin.addListener('readable', read);
}

async function minify() {
    if (!In || /^(-h|--help)$/.test(In))
        return help();
    
    if (/^(-v|--version)$/.test(In))
        return log(`v${Version}`);
    
    const {readOptions} = await import('../lib/read-options.mjs');
    const [optionsError, options] = await tryToCatch(readOptions);
    
    if (optionsError)
        return log.error(optionsError.message);
    
    if (/^--(js|css|html|auto)$/.test(In))
        return readStd(processStream, options);
    
    await uglifyFiles(files, options);
}

async function processStream(chunks, options) {
    if (!chunks || !In)
        return;
    
    const name = In.replace('--', '');
    const {default: minify} = await import(`../lib/${name}.js`);
    
    const [e, data] = await tryToCatch(minify, chunks, options);
    
    if (e)
        return log.error(e);
    
    log(data);
}

async function uglifyFiles(files, options) {
    const {minify} = await import('../lib/minify.js');
    const minifiers = files.map((file) => minify(file, options));
    const all = Promise.all.bind(Promise);
    
    const [error, results] = await tryToCatch(all, minifiers);
    
    if (error)
        return log.error(error);
    
    logAll(results);
}

function logAll(array) {
    for (const item of array)
        log(item);
}

function help() {
    const bin = require('../help.json');
    const usage = 'Usage: minify [options]';
    
    console.log(usage);
    console.log('Options:');
    
    for (const name of Object.keys(bin)) {
        console.log('  %s %s', name, bin[name]);
    }
}
