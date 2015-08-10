/**
 * Dependencies
 */
const debug = require('debug')('collectify:main-app');
const http = require('http');
const highland = require('highland');
const lodash = require('lodash-fp');
const async = require('async');
const util = require('util');
const asyncify = require('asfy');
const EventEmitter = require('events').EventEmitter;
const mongoose = require('mongoose');
const nodeRead = require('node-read');
const obtr = require('fp-object-transform');
const { Transmitter } = require('interprocess-push-stream');

/**
 * Application-specific modules
 */
const config = require('./config');
const setup = require('./setup');

/**
 * Data Models (mongoose)
 */
const Entries = require('./models/entry');
const Sources = require('./models/source');

/**
 * Create a custom http agent
 * and a corresponding
 * options object
 */
const httpAgent = new http.Agent();
httpAgent.maxSockets = 50;

const agentOpts = { agent: httpAgent };

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
const updatesChannel = Transmitter({
  channel: 'entries:updated',
  prefix: config.get('database.redis.prefix'),
  url: config.get('database.redis.url')
});

/**
 * Create instances of our
 * mappers/parsers.
 */
const siteParser = require('site-parser')({ timeOut: 10000 });
const wrapStreamSource = require('./helpers/wrap-stream-source');
const inspect = require('./helpers/inspect').bind(null, debug);

/**
 * Create some curryed
 * helper functions
 * for convenience
 * and readability
 */
const wrap = ::highland.wrapCallback;
const deriveTo = lodash.curry(obtr.deriveTo);
const deriveToSync = lodash.curry(obtr.deriveToSync);
const transformTo = lodash.curry(obtr.transformTo);
const transformToSync = lodash.curry(obtr.transformToSync);
const copyToFrom = lodash.curry(obtr.copyToFrom);
const copy = lodash.compose(highland.flip(highland.extend)({}));
const clone = lodash.compose(JSON.parse, JSON.stringify);
const findSources = lodash.curryN(4, lodash.rearg([2, 1, 0, 3], Sources.find.bind(Sources)));

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
 * Create a partially applied
 * bound function for fetching
 * data from the database
 * using mongoose.
 *
 * In this case templates/sources.
 */
const queryFunction = findSources({})('')({
  active: true
});

/**
 * Create a stream
 * with our query function
 * as the source
 */
const realSource = highland(wrapStreamSource(queryFunction));

/**
 * Create a stream from
 * our test templates
 * without accessing the
 * database
 */
const testSource = highland([require('./templates')]);

/**
 * Creating our stream
 * declaratively
 */
const sourceStream = testSource
  .ratelimit(1, 30000)
  .compact()
  .flatten()
  .ratelimit(10, 1000)
  .errors(emit('error'))

const topStoriesStream = sourceStream
  .fork()
  .filter(lodash.compose(
    lodash.isEqual('site'),
    lodash.result('type')
  ))
  .map(wrap(::siteParser.parse)).parallel(5)
  .map(x => x[0])
  .compact()
  .errors(emit('error'))

const topStoriesUpdatedStream = topStoriesStream
  .fork()
  .flatFilter(wrap(::Entries.compareToPrevious))
  .flatMap(wrap(::Entries.create))
  .invoke('toObject')
  .errors(emit('error'))

/**
 * Connecting to the database
 */
setup.connectToDatabase(
  mongoose,
  config.get('database.mongo.url')
);

/**
 * Handling and starting the streams
 */
topStoriesStream
  .fork()
  .doto(inspect('top-stories-stream'))
  .resume()

topStoriesUpdatedStream
  .fork()
  .doto(inspect('top-stories-updated-stream'))
  .pipe(updatesChannel)

errorStream
  .doto(inspect('error-stream'))
  .resume()
