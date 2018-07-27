/* test.js */
'use strict';

const webapi = require('./libs/webapi')
const EventEmitter = require('events');
const util = require('util')
const net = require('net')
const bp = require('bitcoin-protocol')
const Graph = require('graphlib').Graph;
const fs = require('fs')

// const bcoin = require('bcoin')
// var peer = new bcoin.Peer() //takes options, network
// process.exit(0)

function Queue(){var a=[],b=0;this.getLength=function(){return a.length-b};this.isEmpty=function(){return 0==a.length};this.enqueue=function(b){a.push(b)};this.dequeue=function(){if(0!=a.length){var c=a[b];2*++b>=a.length&&(a=a.slice(b),b=0);return c}};this.peek=function(){return 0<a.length?a[b]:void 0}};

var eventEmitter = new EventEmitter();
net.createServer().listen(); //Used to keep the process running

var visiting = 0
var visited = 0
const vThreshold = 50000
const NUM_ROUNDS = 3;

// var g = new Graph();
var BTCNodes = {}
var vNodes = new Queue();
// var newNodes = 0
// var curNodes = []
// var connections = 0;
var rounds = NUM_ROUNDS; //TODO make it per-node

/* Helper functions */
// function remove(array, element) {
//     const index = array.indexOf(element);
//
//     if (index !== -1) {
//         array.splice(index, 1);
//     }
//     // else console.log("WARN: couldn't remove "+element);
// }

function logHeap(){
  const used = process.memoryUsage().heapTotal / 1024 / 1024;
  console.log(`HEAP ${Math.round(used * 100) / 100} MB`);
// console.log("TOT Size: "+require('v8').getHeapStatistics().total_available_size);
  // const used = process.memoryUsage();
  // for (let key in used) {
  //   console.log(`${key} ${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB`);
  // }
}

function handleNetEvents(events, socket, handler){
  events.forEach(function(e){
    socket.on(e, function(ex){
      handler(e, ex)}
    )
  })

}

Array.prototype.contains = function(element){
    return this.indexOf(element) > -1;
};
/**/

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

  encoder=null
  /**/
}

function endVisit(socket, node){
  visiting--;

  if(!socket){
    console.log("Setting "+node+" offline");
    BTCNodes[node].online = false
  }
  else{
    console.log("Closing connection to "+node);
    socket.end();
    socket.destroy();
    socket = null
  }

  eventEmitter.emit('nodevisited')
}

function visitNode(n){
  visiting++;
  console.log("Visiting "+n);
  //TODO: keep track of number of "visits" to this node (how many times have we asked for peers?)

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
    endVisit(null, n)
  }
  else{
      // Connect to node
      var socket = new net.Socket()
      socket.setTimeout(10000);

      const netevents = ['error', 'end', 'timeout']
      handleNetEvents(netevents, socket, function(e, ex){
        console.log("Event: "+e+"("+n+")"+ (e=='error' ? ":"+ex : ""));

        BTCNodes[n].online = false
        endVisit(socket, n);
      })

      socket.connect(port, ip, function () {
        // connections++;
        var curNode = this.remoteAddress+":"+this.remotePort//ip+":"+port
        console.log("Connected to "+curNode);
        BTCNodes[curNode].online = true

        var encoder = bp.createEncodeStream()
        var decoder = bp.createDecodeStream()

        decoder.on('error', function (message){
          console.log(curNode+" DECODER ERROR: "+message); //Unrecognized command: "encinit"

          BTCNodes[curNode].visited = false //TEMP - handle differently
          endVisit(socket, curNode);
          encoder=null
          decoder=null
        });

        /* Handle received addresses */
        decoder.on('data', function (message) {
          // console.log("Message from "+n+": "+message.command);

          if(message.command == 'addr'){
            // var first_peer = message.payload[0].address+':'+message.payload[0].port;
            // if(first_peer != n){
            if(message.payload.length > 2){
              console.log("Received 'addr' from "+n+" ("+message.payload.length+")");
              //TEMP // if(message.payload.length == 1) console.log(" addr: "+first_peer);
              // g.setNode(n, true)

              // console.log(util.inspect(message.payload[0],false,null));
              // For each peer in 'addr'
              for(var i in message.payload){
                var peer = message.payload[i]
                if(peer.address != undefined){
                  var peeraddr = peer.address+":"+peer.port

                  if(!(peeraddr in BTCNodes)){
                    // console.log("NEW Node: "+peeraddr);
                    BTCNodes[peeraddr]={visited:false, online:undefined}
                    vNodes.enqueue(peeraddr)
                    // newNodes++;
                  }
                  // console.log("NEW Edge: "+n+" <--> "+peeraddr);

                // Add edge n <--> peer
                // if(! g.hasEdge(n, peeraddr)){
                //   g.setEdge(n, peeraddr);
                // }
                // fs.appendFile("./edges.dat", n+"<>"+peeraddr, function(err) {
                //     if(err) {
                //         return console.log(err);
                //     }
                // });
              }
              }

              // Close connection when 'addr' is received
              BTCNodes[n].visited = true
              endVisit(socket, n);
              encoder=null
              decoder=null
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
                  BTCNodes[n].visited = true //TODO, handle these cases a non-visited
                  endVisit(socket, n);
                  encoder=null
                  decoder=null
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

function visitNext(){
  console.log("BTCNodes: "+Object.keys(BTCNodes).length+" -- "+visited);
  console.log("vNodes: "+vNodes.getLength());
  // logHeap()

  //If there are no more nodes to visit, nor nodes visiting, then we are done
  if(vNodes.getLength() == 0 && visiting == 0)
    eventEmitter.emit('done')
  else
    while(vNodes.getLength() > 0 && visiting <= vThreshold){
      visitNode(vNodes.dequeue())
    }
}

//When a node has done, visit the next one in queue
eventEmitter.on('nodevisited', function(){
  visited++
  visitNext()
})

function visitNodes(){
  for(var node in BTCNodes){
    if(!BTCNodes[node].visited && BTCNodes[node].online != false){
      if(visiting < vThreshold)
        visitNode(node)
      else
        vNodes.enqueue(node)
    }
  }
  // if(visiting == 0)
  //   emit('done')
}

/*
eventEmitter.on('nodes', function(){
  if(++segment < segments)
    visitNodes(curNodes.slice(vThreshold*segment, vThreshold*(segment+1)));
  else
    eventEmitter.emit('done')
})
*/

function buildGraph(nodes){
  console.log("buildGraph");
  // console.log('buildGraph: '+util.inspect(nodes, false, null));

  /* Add nodes to G */
  //TODO Add 'online/offline' state
  //g.setNode("c", { k: 123 });
  //g.setNode("b", "b's value");
  //g.node("b"); => "b's value"
  // curNodes = []
  // newNodes = 0

  // segments = Math.ceil(nodes.length / vThreshold) //# rounds needed to visit all nodes
  // segment = 0

  visitNodes()
}//buildGraph()

// This API returns the latest snapshot of know active nodes on the Bitcoin network
var api_url = "https://bitnodes.earn.com/api/v1/snapshots/latest"
webapi.getFromApi(api_url, function (error, result) {
    if (error) console.log(error);
    console.log("Nodes retrieved: "+result.total_nodes);

    // List of nodes to be queried
    // var startNodes = []
    for(var node in result.nodes){
      BTCNodes[node] = {visited:false, online:undefined} //set 'visited'
    } //for node in result

    //NOTE if you want to execute something after buildGraph has done, you need to put a callback function
    buildGraph(); //.slice(0, startNodes.length)

  }) //getFromApi()

  eventEmitter.on('done', function(){
    // if(newNodes > 0){
    //   console.log("newNodes = "+newNodes);
    //   if(--rounds > 0){
    //     buildGraph()
    //   }
    // }
    // else{
      console.log("DONE!");
      // console.log("G: nodes="+g.nodes().length+" edges="+g.edges().length);
      console.log("Total nodes: "+Object.keys(BTCNodes).length);
      process.exit(0);
    // }
  });
