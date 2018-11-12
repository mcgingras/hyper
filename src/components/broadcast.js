import React, { Component } from 'react';
import '../App.css';
import Recorder from 'recorder-js';

var signalhub = require('signalhubws')
var swarm = require('webrtc-swarm')
var getUserMedia = require('getusermedia')
var recorder = require('media-recorder-stream')
var hypercore = require('hypercore')
var ram = require('random-access-memory')
var pump = require('pump')
var cluster = require('webm-cluster-stream')
var MicrophoneStream = require('microphone-stream');
var config = require('../config')
var mimeType = require('../lib/getMimeType')(window.MediaRecorder.isTypeSupported)


export default class Broadcast extends Component {

  constructor(props){
    super(props);

    this.state = {
      key: '',
      rec: null,
      blob: null,
      isRecording: false
    }

    this.startBroadcast = this.startBroadcast.bind(this);
    this.startRecording = this.startRecording.bind(this);
    this.stopRecording = this.stopRecording.bind(this);
    this.download = this.download.bind(this);
  }

  componentWillMount(){
    const audioContext =  new (window.AudioContext || window.webkitAudioContext)();
    const rec = new Recorder(audioContext);
    this.setState({rec: rec});
  }

  startRecording(){
    console.log("This broadcast is being recorded");
    this.state.rec.start()
      .then(() => this.setState({isRecording: true})
  )}

  download(){
    Recorder.download(this.state.blob, 'my-audio-file');
  }

  stopRecording() {
    this.state.rec.stop()
      .then(({blob, buffer}) => {
        this.setState({blob: blob});
    });
  }

  startBroadcast(){
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
          feed.append(data);
       })
     })
   }

  render(){
    return (
      <div>
      <button onClick={this.startBroadcast}>broadcast</button>
      <button onClick={this.stopRecording}>stop recording</button>
      <button onClick={this.download}>download</button>
      <audio id="player2" controls/>
      <p>{this.state.key}</p>
      </div>
    )
  }
}
