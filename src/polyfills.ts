// Import Node.js modules
import { Buffer } from 'buffer';
import process from 'process';
import { EventEmitter } from 'events';
import * as util from 'util';
import * as url from 'url';
import { Stream } from 'stream';

// Node.js polyfills for browser environment
if (typeof window !== 'undefined') {
  // Global object
  (window as any).global = window;
  
  // Process
  (window as any).process = process;
  
  // Buffer
  (window as any).Buffer = window.Buffer || Buffer;
  
  // Events
  (window as any).EventEmitter = EventEmitter;
  
  // Util
  (window as any).util = util;
  
  // URL
  (window as any).url = url;
  
  // Stream
  (window as any).Stream = Stream;
}

// Make this a module
export {};