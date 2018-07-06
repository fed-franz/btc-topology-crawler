/* test.js */
'use strict';

const webapi = require('./webapi')

// This API returns the latest snapshot of know active nodes on the Bitcoin network
var api_url = "https://bitnodes.earn.com/api/v1/snapshots/latest"

webapi.getFromApi(api_url, function (error, result) {
    if (error) console.log(error);

    // console.log('Body: ', JSON.stringify(result, null, 2));

    //Get nodes IP
    var nodes = Object.keys(result.nodes)
    for (var i=0; i<nodes.length; i++){
      console.log(nodes[i]);
    }

  })
