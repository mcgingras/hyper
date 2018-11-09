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
      .then(() => this.state.isRecording = true);
  }

  download(){
    Recorder.download(this.state.blob, 'my-audio-file');
  }

  stopRecording() {
    this.state.rec.stop()
      .then(({blob, buffer}) => {
        this.state.blob = blob;
    });
  }

  startBroadcast(){
    const context = this;
    let rec = context.state.rec;
    getUserMedia({video: context.props.video, audio: context.props.audio},
    function (err, stream) {
       if (err) return console.log('😵 getUserMedia error', err)

       var elPreview = document.getElementById('preview')
       elPreview.muted = true;
       elPreview.srcObject = stream;


       var mediaRecorder = recorder(stream, {
         mimeType: mimeType,
         audioBitsPerSecond: 32000
       })

      rec.init(stream);
      context.startRecording();

       var feed = hypercore(ram)
       feed.on('ready', function () {
         var key = feed.key.toString('hex')
         var discoveryKey = feed.discoveryKey.toString('hex');
         context.setState({key: key});

         var hub = signalhub(discoveryKey, config.signalhub)
         var sw = swarm(hub)
         sw.on('peer', function (peer, id) {
           pump(peer, feed.replicate({ live: true, encrypt: false }), peer)
         })
       })

       var mediaStream = pump(mediaRecorder, cluster())
       mediaStream.on('data', function (data) {
         console.log('⚡️ appending to broadcast:', data)
         feed.append(data)
       })
     })
   }

  render(){
    return (
      <div>
      broadcaster
      <audio id="preview" controls/>
      <button onClick={this.startBroadcast}>broadcast</button>
      <button onClick={this.stopRecording}>stop recording</button>
      <button onClick={this.download}>download</button>
      <p>{this.state.key}</p>
      </div>
    )
  }
}
