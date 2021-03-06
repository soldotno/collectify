'use strict';

/**
 * Dependencies
 */
const http = require('http');
const debug = require('debug')('collectify:websocket-api');
const highland = require('highland');
const lodash = require('lodash-fp');
const EventEmitter = require('events').EventEmitter;
const websocket = require('websocket-stream');
const { Receiver, Transmitter } = require('interprocess-push-stream');

/**
 * Application-specific modules
 */
const config = require('./config');
const inspect = require('./helpers/inspect').bind(null, debug);

/**
 * Create streams for the channels
 * on which we want to
 * distribute / emit data.
 *
 * This uses the push-version
 * of the interface, but you
 * could also use the pull-version,
 * to enable load balancing
 * and back-pressure between
 * processes
 */
const updatesChannel = Receiver({
  channel: 'entries:updated',
  prefix: config.get('database.redis.prefix'),
  url: config.get('database.redis.url')
});

/**
 * Create a new event-emitter
 * which we are going to use
 * for errors
 *
 * We'll also make a curryed
 * version of eventEmitter.emit
 * that we'll use in our
 * application
 */
const eventEmitter = new EventEmitter();
const emit = lodash.curryN(2, eventEmitter.emit.bind(eventEmitter));

/**
 * Create a stream
 * where we'll
 * collect all the
 * errors emitted
 * throughout the
 * the stream pipeline(s)
 */
const errorStream = highland('error', eventEmitter);

/**
 * Create a stream
 * with the newChannel
 * as the source
 */
const updatesStream = highland(updatesChannel)
  .compact()
  .flatten()
  .errors(emit('error'))

/**
 * Log all the updated
 * articles and the
 * resulting entries in
 * mongodb
 */
updatesStream
  .fork()
  .doto(inspect('top-stories-update'))
  .resume()

/**
 * Pipe all errors
 * to the error channel
 */
errorStream
  .doto(inspect('error-stream'))
  .resume()

/**
 * Create an http server
 * which we'll use to
 * attach a websocket server
 */
const httpServer = http.createServer()

/**
 * Create a websocket server
 * where we 'plug' our content
 * stream into the websocket(s)
 *
 * (We also kill the stream when the client ends)
 */
const wss = websocket.createServer({
  server: httpServer
}, (stream) => {
  let contentStream = updatesStream
    .observe()
    .map(JSON.stringify)
    .doto(highland.log)
  
  contentStream.pipe(stream)

  stream.once('close', () => {
    contentStream.destroy();
  });
});

server.listen(3333);
