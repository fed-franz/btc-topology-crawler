/* webapi.js */
/*
 * JS code to make webapi requests.
 * It prints the result and then call the 'callback' function
 */
'use strict';

var request = require('request');
//Example: https://chain.api.btc.com/v3/block/latest/tx
//	url = 'http://api.website.org/v3/'
//	endpoint = block/latest/tx

function postToApi (api_url, json_data, callback) {
  request.post({
      url: api_url,
      headers: {'Content-Type': 'application/json'},
      form: json_data
  },
  function (error, response, body) {
      if (error) {
          return callback(error);
      }
      if (typeof body === 'string') {
          body = JSON.parse(body)
      }
      // console.log('Status: ', response.statusCode);
      return callback(null, body);
  });
}

function getFromApi (api_url, callback) {
    request.get(api_url, function (error, response, body) {
        if (error) return callback(error);

        if (typeof body === 'string')
            body = JSON.parse(body)

        console.log('Status:', response.statusCode);
        return callback(null, body);
    });
}

module.exports = {
  getFromApi: getFromApi,
  postToApi: postToApi
}
