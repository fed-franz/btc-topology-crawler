/* test.js */
'use strict';

const EventEmitter = require('events');
const util = require('util')
const webapi = require('./webapi')
const net = require('net')
const bp = require('bitcoin-protocol')
const Graph = require('graphlib').Graph;

var eventEmitter = new EventEmitter();
net.createServer().listen(); //Used to keep the process running
const NUM_ROUNDS = 3;

var g = new Graph();
var curNodes = []
var newNodes = []
// var connections = 0;
var rounds = NUM_ROUNDS; //TODO make it per-node

/* Helper functions */
function remove(array, element) {
    const index = array.indexOf(element);

    if (index !== -1) {
        array.splice(index, 1);
    }
    // else console.log("WARN: couldn't remove "+element);
}

function handleNetEvents(events, socket, handler){
  events.forEach(function(e){
    socket.on(e, function(ex){
      handler(e, ex)}
    )
  })

}
/**/

function conn_dec(socket, node, callback){
  remove(curNodes, node)
  console.log("Closing connection to "+node+" ("+curNodes.length+")");
  socket.end();
  socket.destroy();

  if(curNodes.length == 0){
    if(newNodes.length > 0){
      console.log("newNodes = "+newNodes.length);
      if(--rounds > 0)
        buildGraph(newNodes)
    }
    else
      eventEmitter.emit('done') //TODO: replace with finalize()?
  }
}

function sendGetAddr(encoder){
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
}

function visitNode(n, callback){
  console.log("Visiting "+n);
  //TODO: keep track of number of "visits" to this node (how many times have we asked for peers?)
  //g.node().counter++;


  //Parse IP and port //TODO mv to separate function
  var ip, port
  if(n[0]=='['){
    ip = (n.split(']')[0]).split('[')[1]
    port = n.split(']:')[1]
  }
  else{
    ip = n.split(':')[0]
    port = n.split(':')[1]
  }

    //TEMP we have problems with IPv6 addresses... TODO Remove this
    if(!net.isIPv4(ip)){
      console.log("Removing "+n);
      remove(curNodes, n)
    }
    else{
      // Connect to node
      var socket = new net.Socket()
      socket.setTimeout(60000);

      const netevents = ['error', 'end', 'timeout']
      handleNetEvents(netevents, socket, function(e, ex){
        console.log("Event: "+e+"("+n+")"+ (e=='error' ? ":"+ex : ""));
        //TODO Mark node as offline/unreachable
        if(e == 'error')
          g.setNode(n, false)
        conn_dec(socket, n, callback);
      })

      socket.connect(port, ip, function () {
        // connections++;
        var curNode = this.remoteAddress+":"+this.remotePort//ip+":"+port
        console.log("Connected to "+curNode);

        var encoder = bp.createEncodeStream()
        var decoder = bp.createDecodeStream()

        decoder.on('error', function (message){
          console.log(curNode+" DECODER ERROR: "+message); //Unrecognized command: "encinit"
          conn_dec(socket, curNode, callback);
        });

        /* Handle received addresses */
        decoder.on('data', function (message) {
          // console.log("Message from "+n+": "+message.command);

          if( message.command == 'addr'){
            var first_peer = message.payload[0].address+':'+message.payload[0].port;
            if(first_peer != n){
              console.log("Received 'addr' from "+n+" ("+message.payload.length+")");
              //TEMP // if(message.payload.length == 1) console.log(" addr: "+first_peer);
              //TEMP
              // console.log(util.inspect(message.payload[0],false,null));
              // For each peer in 'addr'
              for(var i in message.payload){
                var peer = message.payload[i]
                var peeraddr = peer.address+":"+peer.port
                // console.log("  "+peeraddr);

                // If peer is not in G, add it
                if(! g.hasNode(peeraddr)){
                  // console.log("NEW Node: "+peeraddr);
                  g.setNode(peeraddr);
                  newNodes.push(peeraddr)
                }
                // Add edge n <--> peer
                if(! g.hasEdge(n, peeraddr)){
                  // console.log("NEW Edge: "+n+" <--> "+peeraddr);
                  g.setEdge(n, peeraddr);
                }
              }

              // Close connection when 'addr' is received
              // TODO: close only after N requests?
              conn_dec(socket, n, callback);
            }
          }//if('addr')
          else{
              switch (message.command) {
                case 'version':
                case 'verack':
                case 'alert':
                case 'ping':
                case 'sendheaders':
                case 'getaddr':
                case 'inv':
                  break;
                default:
                  console.log("Unexpected command from "+n+": "+message.command); //util.inspect(message, false, null)
                  //mempool, reject,
                  conn_dec(socket, n, callback);
              }
          }
        })//decoder.on('data')

        this.pipe(decoder)
        encoder.pipe(this)

        /* Connects to the node and send 'addr' */
        sendGetAddr(encoder);
      }); //End of getaddr request

  }//isIPv4

}//visitNode

//TODO mv graph code into a function to be called NUM_ROUNDS times
//TODO run it until no news nodes/edges are found

/* Main 'addr' request function */
function buildGraph(nodes, callback){
  console.log('buildGraph: '+util.inspect(nodes, false, null));

  //TODO Add 'online/offline' state
  //g.setNode("c", { k: 123 });
  //g.setNode("b", "b's value");
  //g.node("b"); => "b's value"

  curNodes = []
  nodes.forEach(function(node){
    g.setNode(node, true)
    curNodes.push(node)
  })

  newNodes = []
  nodes.forEach(function(node){
    visitNode(node, callback)
  })

}//buildGraph()


// This API returns the latest snapshot of know active nodes on the Bitcoin network
var api_url = "https://bitnodes.earn.com/api/v1/snapshots/latest"
webapi.getFromApi(api_url, function (error, result) {
    if (error) console.log(error);
    console.log("Nodes retrieved: "+result.total_nodes);

    // List of nodes to be queried
    for(var node in result.nodes){
      newNodes.push(node)
    } //for node in result

    //NOTE if you want to execute something after buildGraph has done, you need to put a callback function
    buildGraph(newNodes, function(){ //newNodes.slice(0, 100)
      console.log("buildGraph finished");
    })

  }) //getFromApi()

  eventEmitter.on('done', function(){
    process.stdout.write("DONE!");
    console.log("G: nodes="+g.nodes().length+" edges="+g.edges().length);
    process.exit(0);
  });
