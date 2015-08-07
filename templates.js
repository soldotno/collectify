exports = module.exports = [{
  "active": true,
  "type": "site",
  "name": "New Yorker",
  "url": "http://www.newyorker.com/",
  "format": "desktop",
  "template": {
    "containers": [{
      "selector": "article",
      "elements": [{
        "name": "url",
        "type": "url",
        "occurence": "first",
        "required": true,
        "items": [{
          "selector": "section h2 a",
          "attribute": "href"
        }]
      }, {
        "name": "title",
        "required": true,
        "occurence": "first",
        "items": [{
          "selector": "section h2 a"
        }]
      }, {
        "name": "image",
        "type": "url",
        "occurence": "first",
        "fallback": null,
        "items": [{
          "selector": "figure a img",
          "attribute": "src"
        }, {
          "selector": "figure a img",
          "attribute": "data-lazy-src"
        }]
      }]
    }]
  }
}];
