import React, { Component } from 'react';
import './App.css';

var signalhub = require('signalhubws')
var swarm = require('webrtc-swarm')
var getUserMedia = require('getusermedia')
var recorder = require('media-recorder-stream')
var hypercore = require('hypercore')
var ram = require('random-access-memory')
var pump = require('pump')
var cluster = require('webm-cluster-stream')
var MicrophoneStream = require('microphone-stream'); // low KEY this jawn might be a better way to do audio, if it is breaking lets plan on looking into this one TODO:
var config = require('./config')
var mimeType = require('./lib/getMimeType')(window.MediaRecorder.isTypeSupported)

class App extends Component {
  constructor(props){
    super(props);

    // state for ya boi
    this.state = {
      mediaStream: "",
      streamArr: [],
      key: ""
    }

    // creating ref to get input value
    this.input = React.createRef();

    // bindings
    this.startBroadcast = this.startBroadcast.bind(this);
    this.stopBroadcast = this.stopBroadcast.bind(this);
    this.playBroadcast = this.playBroadcast.bind(this);
    this.playFeed = this.playFeed.bind(this);
  }

  startBroadcast() {
    console.log('***we are starting the broadcast***');
    var context = this;

    getUserMedia({audio: true, video: false},
    function (err, stream) {
       if (err) return console.log('😵 getUserMedia error', err)

       var mediaRecorder = recorder(stream, {
         audioBitsPerSecond: 32000,
       })

       context.setState({mediaStream: mediaRecorder});

       // I think this feed thing is what I want to look at most closely to understand
       // how the distributed part is working
       var feed = hypercore(ram);
       feed.on('ready', function () {
         console.log("this jawn is ready");
         var key = feed.key.toString('hex')
         var discoveryKey = feed.discoveryKey.toString('hex');
         console.log(key);
         console.log(discoveryKey);
         context.setState({key: key});

         var hub = signalhub(discoveryKey, config.signalhub)
         var sw = swarm(hub);

         // when we find a new peer, we want to replicate all the data that is
         // currently in the feed so they are up to date as well.
         sw.on('peer', function (peer, id) {
           console.log("we found a peer");
           pump(peer, feed.replicate({ live: true, encrypt: false }), peer)
         })
       })

       // anytime new data comes in, we want to append it to the feed
       // right now also appending to this setState thing
       mediaRecorder.on("data", function (data) {
          context.setState({streamArr: [...context.state.streamArr, data]})
          feed.append(data);
       })
     })
   }


  stopBroadcast(){
    var context = this;
    var mediaStream = context.state.mediaStream;
    mediaStream.stop();
  }

  playBroadcast(){
    const context = this;
    const data = context.state.streamArr;
    var mediaSource = new window.MediaSource();

    mediaSource.addEventListener('sourceopen', open)
    var elPlayer = document.getElementById('player')
    elPlayer.src = window.URL.createObjectURL(mediaSource);

    function open () {
      var sourceBuffer = mediaSource.addSourceBuffer(mimeType);

      var d1 = data.shift();
      sourceBuffer.appendBuffer(d1);

      sourceBuffer.addEventListener('updateend', function() {
        if ( data.length ) {
          sourceBuffer.appendBuffer(data.shift());
          console.log(sourceBuffer);
        }
      }, false);
    }
  }

  // this is the one that users hypercore
  playFeed(){
    const context = this;
    const data = context.state.streamArr;
    var mediaSource = new window.MediaSource();

    mediaSource.addEventListener('sourceopen', open)
    var elPlayer = document.getElementById('player')
    elPlayer.src = window.URL.createObjectURL(mediaSource);

    function open () {
      var sourceBuffer = mediaSource.addSourceBuffer(mimeType);

      var hash = context.input.value;
      console.log(hash);
      var feed = hypercore(ram, hash, {sparse: true});

      feed.on('ready', () => {
        console.log("the feed is ready");

        feed.download({ linear: true }, () => {
          // once feed is done
          console.log(feed);
        })
      })

      var key = feed.discoveryKey.toString('hex')
      var hub = signalhub(key, config.signalhub)
      var sw = swarm(hub)
      console.log('🌐 connecting to swarm')

      sw.on('peer', function (peer, id) {
        console.log('🙋 new peer found:', id)
        pump(peer, feed.replicate({ live: true, download: true, encrypt: false }), peer)
      })

      var count = 0;
      feed.get(count, (err,data) => {
        console.log(data.buffer);
        sourceBuffer.appendBuffer(data);
      })

      sourceBuffer.addEventListener('updateend', () => {
        count++;
        feed.get(count, (err,data) => {
          console.log(data.buffer);
          sourceBuffer.appendBuffer(data);
        })
      })
    }

  }


  render() {
    return (
      <div className="App">
        <button onClick={this.startBroadcast}>broadcast</button>
        <button onClick={this.stopBroadcast}>stop</button>
        <button onClick={this.playBroadcast}>play</button>
        <button onClick={this.playFeed}>play (feed)</button>
        <input
          id="stationId"
          ref={node => this.input = node}
           />
           {this.state.key}
        <audio id="player" controls />
      </div>
    );
  }
}

export default App;
