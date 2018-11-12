import React, { Component } from 'react';

var signalhub = require('signalhubws')
var swarm = require('webrtc-swarm')
var recorder = require('media-recorder-stream')
var hypercore = require('hypercore')
var ram = require('random-access-memory')
var pump = require('pump')
var config = require('../config')
var mimeType = require('../lib/getMimeType')(window.MediaRecorder.isTypeSupported)

export default class Watch extends Component {
  constructor(props){
    super(props);
    this.input = React.createRef();
    this.startWatching = this.startWatching.bind(this);
  }

  startWatching () {
    const context = this;
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
        feed.download({ linear: true })
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
        sourceBuffer.appendBuffer(data);
      })

      sourceBuffer.addEventListener('updateend', () => {
        count++;
        feed.get(count, (err,data) => {
          sourceBuffer.appendBuffer(data);
        })
      })
    }
  }


  render(){
    let input;
    return (
      <div>
      <audio id="player" controls/>
      <input
        id="stationId"
        ref={node => this.input = node}
         />
      <button onClick={this.startWatching}>listen</button>
      </div>
    )
  }
}
