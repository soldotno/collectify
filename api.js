/**
 * Dependencies
 */
const debug = require('debug')('collectify:api');
const http = require('http');
const express = require('express');
const highland = require('highland');
const lodash = require('lodash-fp');
const async = require('async');
const util = require('util');
const mongoose = require('mongoose');
const app = express();

/**
 * Application-specific modules
 */
const config = require('./config');
const setup = require('./setup');

/**
 * Helpers
 */
const wrap = ::highland.wrapCallback;
const wrapStreamSource = require('./helpers/wrap-stream-source');

/**
 * Data Models (mongoose)
 */
const Entries = require('./models/entry');
const Sources = require('./models/source');

/**
 * Connect to the database
 */
setup.connectToDatabase(
  mongoose,
  config.get('database.mongo.url')
);

/**
 * Route for fetching
 * the latest story
 * from each source
 */
app.get('/articles', (req, res) => {
  highland(wrapStreamSource(::Sources.find)
    .pick('_source')
    .map(wrap(::Entries.findLatest))
    .compact()
    .toArray(::res.send)
    .errors(::res.status(500)::res.send);
});

/**
 * Start server
 */
app.listen(3000);
