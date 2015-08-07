const mongoose = require('mongoose');
const _ = require('lodash-fp');
const asap = require('asap');
const sortedObject = require('sorted-object');

const schema = new mongoose.Schema({
  _ranking: {
    type: Number,
    required: true,
    index: true
  },
  _source: {
    type: String,
    required: true,
    index: true
  },
  _origin: {
    type: String,
    required: true
  },
  _host: {
    type: String,
    required: true,
    index: true,
  },
  url: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true
  },
  image: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400, // ttl in seconds
    required: true
  }
});

schema.set('toObject', {
  transform(doc, ret, options) {
    // delete ret._id;
    delete ret.__v;
    // delete ret.createdAt; enable this if you do not want to update the expiry
  }
});

schema.set('toJSON', {
  transform(doc, ret, options) {
    // delete ret._id;
    delete ret.__v;
    // delete ret.createdAt; enable this if you do not want to update the expiry
  }
});

schema.statics.compareToPrevious = function(entry, cb) {
  if (!entry._source) return cb();

  this.findOne({ _source: entry._source })
    .sort({ createdAt: -1 })
    .exec(function(err, result) {
      if (err) return cb(err);

      let normalizedResult = (result || {}).toJSON ? result.toJSON() : {};
      let formatObject = _.pick(['title', 'image', 'url']);
      let existingEntry = JSON.stringify(sortedObject(formatObject(normalizedResult)));
      let newEntry = JSON.stringify(sortedObject(formatObject(entry)));

      cb(null, existingEntry !== newEntry);
    });
};

// create the model for articles and return it
module.exports = mongoose.model('entry', schema);
