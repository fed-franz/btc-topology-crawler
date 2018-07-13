/* test.js */
'use strict';

// const util = require('util')
const webapi = require('./webapi')
var net = require('net')
var bp = require('bitcoin-protocol')
var Graph = require('graphlib').Graph;

var g = new Graph();

// This API returns the latest snapshot of know active nodes on the Bitcoin network
var api_url = "https://bitnodes.earn.com/api/v1/snapshots/latest"
webapi.getFromApi(api_url, function (error, result) {
    if (error) console.log(error);
    console.log("Nodes retrieved: "+result.total_nodes);

    var nodeList = []

    //Add nodes to the graph
    for(var node in result.nodes){
      // console.log(node);
      g.setNode(node)
      //TODO Add node to graph
      nodeList.push(node)
    } //for node in result

    // console.log('nodeList: '+nodeList);

    //For each node in the list...
    //TODO: instead of a list, use a queue and a counter (to make n requests for each address)
    nodeList.forEach(function(n){
      // console.log("NODE: "+n);

      //Parse IP and port
      var ip, port
      if(n[0]=='['){
        ip = (n.split(']')[0]).split('[')[1]
        port = n.split(']:')[1]
      }
      else{
        ip = n.split(':')[0]
        port = n.split(':')[1]
      }
      // console.log("IP:"+ip+" port:"+port);

      if(net.isIPv4(ip)){ //TEMP we have problems with IPv6 addresses...
        var socket = new net.Socket()
        // Connect to node
        socket.connect(port, ip, function () { //nodeList[0]
          console.log("Connected to "+ip);
          // if(error){ console.log(error); return error}
          /**/
          var encoder = bp.createEncodeStream()
          //Handle received peers
          var decoder = bp.createDecodeStream()

          decoder.on('error', function (message){
            console.log("DECODER ERROR: "+message);
          });

          /* Handle received addresses */
          decoder.on('data', function (message) {
            if(message.command == 'addr' && message.payload.length > 1){ //message.payload[0].address != ip){
              console.log("NEW addr message ("+message.payload.length+")");
              console.log("Node "+n+" : ");
              // For each peer in 'addr'
              for(var i in message.payload){
                var peer = message.payload[i]
                console.log("  "+peer.address+":"+peer.port);
                //TODO: check if we know the node. If not, add it to G and to nodeList;
                //Add edge between n and peer
              }

              // Close connection when 'addr' is received
              socket.destroy();
            }//if('addr')
          })//decoder.on('data')

          socket.pipe(decoder)
          encoder.pipe(socket)

          /* Perform handshake message */
          // 'version' //
          encoder.write({
              magic: 0xd9b4bef9,
              command: 'version',
              payload: {
                version: 70012,
                services: Buffer.alloc(8).fill(0),
                timestamp: Math.round(Date.now() / 1000),
                receiverAddress: {
                  services: Buffer.from('0100000000000000', 'hex'),
                  address: '0.0.0.0',
                  port: 8333
                },
                senderAddress: {
                  services: Buffer.alloc(8).fill(0),
                  address: '0.0.0.0',
                  port: 8333
                },
                nonce: Buffer.alloc(8).fill(123),
                userAgent: 'foobar',
                startHeight: 0,
                relay: true
              }//payload
          })
          // 'verack' //
          encoder.write({
          magic: 0xd9b4bef9,
          command: 'verack',
          payload: ''
          })

          /* Request peers */
          encoder.write({
          magic: 0xd9b4bef9,
          command: 'getaddr',
          payload: ''
          })
          /**/
        });

        socket.on('error', function(ex) {
          console.log("handled error");
          console.log(ex);
          //TODO Mark node as offline
          socket.destroy();
        });
        // })//net.connect
        //End of getaddr request
      //Using graph lib
      //add addresses as nodes
      //add connections as edges

    }//isIPv4
    }) //nodeList.forEach



  }) //getFromApi()
