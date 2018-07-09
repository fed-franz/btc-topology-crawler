/* test.js */
'use strict';

// const util = require('util')
const webapi = require('./webapi')
var net = require('net')
var bp = require('bitcoin-protocol')

// This API returns the latest snapshot of know active nodes on the Bitcoin network
var api_url = "https://bitnodes.earn.com/api/v1/snapshots/latest"

webapi.getFromApi(api_url, function (error, result) {
    if (error) console.log(error);

    // console.log('Body: ', JSON.stringify(result, null, 2));

    //Get nodes IP
    // console.log(result.total_nodes);
    // for(var node in result.nodes)
    //   console.log(node);

    //Using btc lib
    //ask getpeers for each node
    //add nodes if not in the list
    //create edges
    var decoder = bp.createDecodeStream()
    decoder.on('data', function (message) {
        if(message.command === 'addr'){
          console.log("NEW addr message ("+message.payload.length+")");
          for(var i in message.payload){
            var peer = message.payload[i]
            console.log(peer.address);
          }
          // for(var i=0; i < peers.length; i++)
          //   console.log(peers[i])
        }

      }
    )

    var encoder = bp.createEncodeStream()

    var socket = net.connect(8333, '72.11.174.71', function () {
  socket.pipe(decoder)
  encoder.pipe(socket)

  encoder.write({
    magic: 0xd9b4bef9,
    command: 'version',
    payload: {
      version: 70012,
      services: Buffer(8).fill(0),
      timestamp: Math.round(Date.now() / 1000),
      receiverAddress: {
        services: Buffer('0100000000000000', 'hex'),
        address: '0.0.0.0',
        port: 8333
      },
      senderAddress: {
        services: Buffer(8).fill(0),
        address: '0.0.0.0',
        port: 8333
      },
      nonce: Buffer(8).fill(123),
      userAgent: 'foobar',
      startHeight: 0,
      relay: true
    }
  })

  encoder.write({
    magic: 0xd9b4bef9,
    command: 'verack',
    payload: ''
  })

  encoder.write({
    magic: 0xd9b4bef9,
    command: 'getaddr',
    payload: ''
  })
})



    //Using graph lib
    //add addresses as nodes
    //add connections as edges

  })
